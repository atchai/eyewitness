'use strict';

const extender = require(`object-extender`);
const utilities = require(`../../modules/utilities`);

/*
 * Allows all dependencies to be obtained on a single line.
 */
function prepareDependencies () {

	return {
		database: this.__dep(`database`),
		MessageObject: this.__dep(`MessageObject`),
		sharedLogger: this.__dep(`sharedLogger`),
		scheduler: this.__dep(`scheduler`),
	};

}

/*
 * Updates the bot's memory with the result of the hook execution.
 */
async function updateBotMemory (hookResult, action, recUser) {

	// Do we need to remember the result?
	if (!action.memory || !recUser) { return; }

	// Update the bot's memory.
	try {
		await this.updateUserMemory(hookResult, action.memory, recUser, action.errorMessage);
	}
	catch (err) {
		throw new Error(`Failed to update memory after hook because of "${err}".`);
	}

}

/*
 * Do something useful with the error message coming from the hook.
 */
async function handleHookError (err, action, recUser, sharedLogger, MessageObject) {

	// If an error message has been specified lets send it to the user.
	if (action.errorMessage && recUser) {
		const newMessage = MessageObject.outgoing(recUser, { text: action.errorMessage });
		await this.sendMessage(recUser, newMessage);
	}

	sharedLogger.error(err);

}

/*
 * Execute the hook specified in the action and wait for it to resolve.
 */
module.exports = async function __executeActionExecuteHook (action, recUser, message) {

	const hook = this.__getHook(action.hook);

	if (!hook) { throw new Error(`The hook "${action.hook}" has not been defined.`); }

	const hookFunc = hook.definition;

	if (typeof hookFunc !== `function`) { throw new Error(`The hook "${action.hook}" does not export a function.`); }

	const { database, MessageObject, sharedLogger, scheduler } = prepareDependencies.call(this);
	const actionCopy = extender.clone(action);
	const variables = this.prepareVariables(recUser);
	let finishMode = null;

	// All the items and methods that get made available to the hook.
	const resources = {
		database,
		MessageObject,
		sharedLogger,
		recUser,
		sendMessage: this.sendMessage.bind(this),
		scheduler,
		message,
		flows: this.flows,
		evaluateReferencedVariables: this.evaluateReferencedVariables.bind(this),
		evaluateConditional: this.evaluateConditional.bind(this),
		updateUserMemory: this.updateUserMemory.bind(this),
		doesTextMatch: this.doesTextMatch.bind(this),
		executeAnotherHook: this.executeAnotherHook.bind(this, recUser, message),
		delay: utilities.delay,
		trackUser: this.trackUser.bind(this),
		trackEvent: this.trackEvent.bind(this),
		handleCommandIfPresent: this.handleCommandIfPresent.bind(this),
		finishFlowAfterHook: () => finishMode = `after-hook`,
		changeFlow: nextUri => {
			finishMode = `immediately`;
			return this.__executeActionChangeFlow({ type: `change-flow`, nextUri }, recUser, message);
		},
	};

	// Attempt to execute the hook.
	try {

		const hookResult = await hookFunc(actionCopy, variables, resources);

		// If we changed flow or otherwise caused a break, then we don't do anything with the hook result and must stop.
		if (finishMode === `immediately`) { return false; }

		await updateBotMemory.call(this, hookResult, action, recUser);

	}
	catch (err) {
		handleHookError.call(this, err, action, recUser, sharedLogger, MessageObject);
		return false;
	}

	// Allow the flow to continue onto the next action as long as the hook didn't trigger a break.
	return (finishMode !== `after-hook`);

};
