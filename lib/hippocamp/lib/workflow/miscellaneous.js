'use strict';

/*
 * WORKFLOW: MISCELLANEOUS
 * Functions that don't fit into any other sub module of the Workflow Manager.
 */

const extender = require(`object-extender`);
const utilities = require(`../modules/utilities`);

/*
 * Returns just the base flow URL without the action index.
 */
const __getBaseFlowUri = function __getBaseFlowUri (uri) {
	return uri.split(`#`)[0];
};

/*
 * Ensures the given input (URI or dynamic flow Object ID) is normalised into a standard flow URI format.
 * E.g. "/some/flow" or "/some/flow#4".
 */
function __normaliseFlowUri (input, favourDynamic = false) {

	let normalisedUri = (input || ``).toLowerCase();
	const hasProtocol = Boolean(normalisedUri.match(/^[a-z]+:\/\//i));

	// Add the protocol if it's missing.
	if (!hasProtocol) {
		const baseUri = __getBaseFlowUri(normalisedUri);
		const protocol = ((!baseUri || normalisedUri.match(/\//)) && !favourDynamic ? `static` : `dynamic`);
		normalisedUri = `${protocol}://${normalisedUri.match(/^\//) ? `` : `/`}${normalisedUri}`;
	}

	// Remove trailing slashes and hashes, if any, as well as "#0" ("/some/flow#0" is the same as "/some/flow").
	normalisedUri = normalisedUri.replace(/(:\/\/\/(?:.*))\/(#|$)/g, `$1$2`).replace(/(#0?)$/g, ``);

	return normalisedUri;

}

/*
 * Pulls the flow's URI from its path and normalises it.
 */
function __parseFlowUriFromPath (baseDir, flowFilePath) {

	let uri = flowFilePath.toLowerCase();

	uri = uri.replace(baseDir.toLowerCase(), ``);
	uri = uri.replace(/\//g, `/`);
	uri = uri.replace(/\.json$/i, ``);
	uri = uri.replace(/\/index$/i, ``);
	uri = (uri[0] !== `/` ? `/${uri}` : uri);

	return this.__normaliseFlowUri(uri);

}

/*
 * Returns true if the two given flow URIs match. If strict is true then we'll match against the full URI including the
 * action index e.g. "/some/flow#2"
 */
function __doesFlowUriMatch (inputA, inputB, strict = false) {

	let flowUriA = this.__normaliseFlowUri(inputA);
	let flowUriB = this.__normaliseFlowUri(inputB);

	// If we're not in strict mode just match against the base flow URI and not the action index.
	if (!strict) {
		flowUriA = this.__getBaseFlowUri(flowUriA);
		flowUriB = this.__getBaseFlowUri(flowUriB);
	}

	return Boolean(flowUriA === flowUriB);

}

/*
 * Filters the array of options by their conditionals, if any.
 */
function __filterConditionalOptions (options, recUser) {

	if (!options || !options.length) { return []; }

	const variables = extender.merge(this.options.messageVariables, recUser.profile, recUser.appData);
	return options.filter(option => this.evaluateConditional(option.conditional, variables));

}

/*
 * Returns a dictionary of variables to pass to the hook.
 */
function prepareVariables (recUser) {

	const { profile, appData } = recUser || {};
	const variables = extender.merge(this.options.messageVariables, profile, appData);

	return variables;

}

/*
 * Executes another hook within the same context of the current hook.
 */
async function executeAnotherHook (recUser, message, input) {
	const action = (typeof input === `string` ? { hook: input } : input);
	return this.__executeActionExecuteHook(action, recUser, message);
}

/*
 * Send a message to the given user.
 */
async function sendMessage (recUser, message) {

	// Skip if the bot has been disabled for this user.
	if (this.skipIfBotDisabled(`send message`, recUser)) {
		return false;
	}

	const adapterName = recUser.channel.name;
	const adapter = this.__dep(`adapter-${adapterName}`);
	message.sendDelay = utilities.calculateSendMessageDelay(message, this.options.sendMessageDelay);

	await adapter.markAsTypingOn(recUser);
	await utilities.delay(message.sendDelay);
	return await adapter.sendMessage(recUser, message);

}

/*
 * Export.
 */
module.exports = {
	__normaliseFlowUri,
	__getBaseFlowUri,
	__parseFlowUriFromPath,
	__doesFlowUriMatch,
	__filterConditionalOptions,
	prepareVariables,
	executeAnotherHook,
	sendMessage,
};
