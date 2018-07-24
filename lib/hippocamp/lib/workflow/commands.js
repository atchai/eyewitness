'use strict';

/*
 * WORKFLOW: COMMANDS
 * Functions for dealing with commands.
 */

const path = require(`path`);
const deepSort = require(`deep-sort`);
const extender = require(`object-extender`);

/*
 * Load all of the default command definitions in order.
 */
async function __loadDefaultCommands (commandCache) {

	const sharedLogger = this.__dep(`sharedLogger`);

	sharedLogger.debug(`Loading default commands...`);

	const defaultCommandsDirectory = path.join(__dirname, `../commands`);
	const defaultCommandFiles = await this.discoverFiles(defaultCommandsDirectory, `json`, false);
	const numDefaultCommands = defaultCommandFiles.length;

	// Iterate over command definitions.
	for (const commandFile of defaultCommandFiles) {
		const commandName = this.parseFilename(commandFile, `json`);

		commandCache[commandName] = {
			commandName,
			isAppCommand: false,
			priority: -100,
			definition: await this.parseJsonFile(commandFile), // eslint-disable-line no-await-in-loop
		};
	}

	return numDefaultCommands;

}

/*
 * Load all of the app command definitions in order, merging into any matching default commands.
 */
async function __loadAppCommands (commandCache, directory) {

	const sharedLogger = this.__dep(`sharedLogger`);

	sharedLogger.debug(`Loading app commands...`);

	const appCommandFiles = await this.discoverFiles(directory, `json`, false);
	const numAppCommands = (appCommandFiles ? appCommandFiles.length : 0);

	// Iterate over command definitions.
	for (const commandFile of appCommandFiles) {
		const commandName = this.parseFilename(commandFile, `json`);
		const definition = await this.parseJsonFile(commandFile); // eslint-disable-line no-await-in-loop
		const priority = definition.priority || 0;
		delete definition.priority;

		// Merge the app command into an existing default command, if any.
		if (commandCache[commandName]) {
			commandCache[commandName].definition = extender.merge(commandCache[commandName].definition, definition);
			commandCache[commandName].isAppCommand = true;
			commandCache[commandName].priority = priority;
		}

		// Otherwise just add the app command as-is.
		else {
			commandCache[commandName] = {
				commandName,
				isAppCommand: true,
				priority,
				definition,
			};
		}
	}

	return numAppCommands;

}

/*
 * Load and cache all the commands in the top-level commands directory (not its subdirectories).
 */
async function __loadCommands (directory) {

	const sharedLogger = this.__dep(`sharedLogger`);
	const commandCache = [];
	const numDefaultCommands = await this.__loadDefaultCommands(commandCache);
	const numAppCommands = await this.__loadAppCommands(commandCache, directory);

	// Add commands and sort them by priority.
	this.commands = Object.values(commandCache);
	deepSort(this.commands, `priority`, `desc`);

	sharedLogger.debug(`${numDefaultCommands} default and ${numAppCommands} app command files loaded.`);

}

/*
 * Find and execute a command if one matches. Returns true if we did execute a command, otherwise false.
 */
async function handleCommandIfPresent (message, recUser) {

	// Skip if the bot has been disabled for this user.
	if (this.skipIfBotDisabled(`handle command if present`, recUser)) {
		return false;
	}

	// Does a command match?
	const command = await this.__findMatchingCommand(message.text);
	if (!command) { return false; }

	// Successfully actioned a matching command.
	await this.__executeCommand(command, message, recUser);
	return true;

}

/*
 * Execute the given command.
 */
async function __executeCommand (command, message, recUser) {

	// Update the bot's memory, if required, and handle errors.
	if (command.definition.memory) {

		const MessageObject = this.__dep(`MessageObject`);
		const sharedLogger = this.__dep(`sharedLogger`);
		const errorMessage = `There was a problem saving data into memory.`;

		try {
			await this.updateUserMemory(message, command.definition.memory, recUser, errorMessage);
		}
		catch (err) {

			const commandName = command.commandName;
			const validationErrorMessage = MessageObject.outgoing(recUser, {
				text: err.message,
			});

			await this.sendMessage(recUser, validationErrorMessage);
			const errMemory = new Error(`Failed to update memory from command "${commandName}" because of "${err}".`);
			sharedLogger.error(errMemory);

			throw errMemory;

		}

	}

	// Execute all the actions in the order they are specified.
	const commandName = command.commandName;
	const actions = command.definition.actions;

	await this.executeActions(`command`, commandName, actions, recUser, message);

}

/*
 * Finds a command that matches the given message text using textual matching or NLP matching (if configured).
 */
async function __findMatchingCommand (text) {

	const sharedLogger = this.__dep(`sharedLogger`);

	sharedLogger.verbose(`Trying to match commands using textual matching.`);

	// Check each of the commands for textual matches first.
	for (const index in this.commands) {
		if (!this.commands.hasOwnProperty(index)) { continue; }

		const command = this.commands[index];
		if (await this.doesTextMatch(command.definition.matches, text)) { return command; } // eslint-disable-line no-await-in-loop
	}

	// Don't try to match with NLP if NLP has been disabled.
	if (!this.options.enableNlp) {
		sharedLogger.debug(`Unable to use NLP command matching because NLP is disabled.`);
		return null;
	}

	// Was there a matching NLP command?
	const matchedCommand = await this.__findMatchingCommandByIntent(text, true);
	return matchedCommand || null;

}

/*
 * Finds a command that matches the given message text using NLP matching (if configured).
 */
async function __findMatchingCommandByIntent (text, requireAggressiveMatching = false) {

	let nlp;

	const sharedLogger = this.__dep(`sharedLogger`);

	// Make sure we can get a NLP handler first.
	try {
		nlp = this.__dep(`nlp`);
	}
	catch (err) {
		sharedLogger.debug({
			text: `NLP is enabled but an NLP handler has not been configured: "${err}".`,
			requireAggressiveMatching,
		});
		return null;
	}

	sharedLogger.verbose({
		text: `Trying to match commands using NLP intent matching using "${nlp.getHandlerId()}".`,
		requireAggressiveMatching,
	});

	// Parse the intents using the NLP service.
	const { intents: nlpIntents } = await nlp.parseMessage(text);
	const highestMatchingCommand = {
		command: null,
		score: 0,
	};

	sharedLogger.debug({
		text: `Matched the following NLP intents using "${nlp.getHandlerId()}".`,
		nlpIntents,
	});

	// Check each command for intents.
	for (const index in this.commands) {
		if (!this.commands.hasOwnProperty(index)) { continue; }

		// Skip commands without intents.
		const command = this.commands[index];

		if (!command.definition.intents) { continue; }

		// Check each intent specified in the command.
		Object.entries(command.definition.intents).forEach(([ intentName, intentData ]) => {

			const {
				threshold: scoreThreshold,
				aggressive: isAggressive = false,
			} = (typeof intentData === `number` ? { threshold: intentData } : intentData);

			// Skip command intents that are not aggressive when aggressive matching is required.
			if (requireAggressiveMatching && !isAggressive) { return; }

			// Skip command intents that weren't matched by the NLP service.
			const matchedIntent = nlpIntents[intentName];
			if (!matchedIntent) { return; }

			// The NLP matched intent's score must surpass the threshold specified in the command.
			if (matchedIntent.score >= scoreThreshold && matchedIntent.score > highestMatchingCommand.score) {
				highestMatchingCommand.command = command;
				highestMatchingCommand.score = matchedIntent.score;
			}

		});
	}

	return highestMatchingCommand.command;

}

/*
 * Export.
 */
module.exports = {
	__loadDefaultCommands,
	__loadAppCommands,
	__loadCommands,
	handleCommandIfPresent,
	__executeCommand,
	__findMatchingCommand,
	__findMatchingCommandByIntent,
};
