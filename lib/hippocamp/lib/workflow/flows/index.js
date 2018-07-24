'use strict';

/*
 * WORKFLOW: FLOWS
 * Functions for dealing with conversation flows.
 */

const loadingFlows = require(`./loadingFlows`);

/*
 * Returns the given flow by its URI.
 */
function __getFlow (fullUri) {
	// defaults to static if scheme not specified
	const normalisedUri = this.__normaliseFlowUri(fullUri);
	const baseUri = this.__getBaseFlowUri(normalisedUri);
	if (this.flows[baseUri]) {
		return this.flows[baseUri];
	}
	else { // not found, try the same as a dynamic flow
		const dynamicUri = this.__normaliseFlowUri(fullUri, true);
		const dynamicBaseUri = this.__getBaseFlowUri(dynamicUri);
		if (this.flows[dynamicBaseUri]) {
			return this.flows[dynamicBaseUri];
		}
		else { // still not found, try canonical URI
			const matchingFlows = Object.values(this.flows)
				.filter(flow => flow.definition.canonicalUri &&
          flow.definition.canonicalUri === dynamicBaseUri);
			return matchingFlows.length ? matchingFlows[0] : null;
		}
	}
}

/*
 * Returns just the dynamic flows.
 */
function __getDynamicFlows () {
	return Object.values(this.flows).filter(flow => flow.type === `dynamic`);
}

/*
 * Redirect to another flow if necessary.
 */
async function __handleFlowRedirectToNewFlow (flow, recUser, message) {

	// Skip if we don't have a redirect flow type.
	if (flow.definition.type !== `redirect`) {
		return;
	}

	// Move to next flow.
	await this.executeFlow(flow.definition.nextUri, recUser, message);
	throw new Error(`STOP_SUCCESSFULLY_COMPLETED`);

}

/*
 * Execute all the actions in the given flow.
 */
async function __handleFlowExecuteActions (flow, recUser, message) {

	// Execute all the actions in the order they are specified, and stop here if one of the actions redirects us.
	const actions = flow.definition.actions;
	const continueWithFlow = await this.executeActions(`flow`, flow.uri, actions, recUser, message);

	if (!continueWithFlow) {
		throw new Error(`STOP_SUCCESSFULLY_COMPLETED`);
	}

}

/*
 * Add different properties to the message depending on the type of prompt.
 */
function __addFlowPromptMessageProperties (flow, recUser, filteredOptions, properties) {

	switch (flow.definition.prompt.type) {

		case `options`: {
			const allOptions = flow.definition.prompt.options || [];

			if (!filteredOptions.length) {
				let msg;

				if (filteredOptions.length < allOptions.length) {
					msg = `Disabling all options with conditionals when using the "options" prompt is not allowed.`;
				}
				else {
					msg = `At least one option must be included when using the "options" prompt.`;
				}

				throw new Error(msg);
			}

			properties.options = filteredOptions;
			break;
		}

		case `webview`:
			properties.buttons = [ this.__getWebviewOpenButtonDefinition(flow.uri, recUser, flow.definition.prompt) ];
			break;

		case `basic`:
			properties.options = (filteredOptions && filteredOptions.length ? filteredOptions : void (0));
			break;

		default:
			throw new Error(`Invalid prompt type "${flow.definition.prompt.type}" in flow "${flow.uri}".`);

	}

}

/*
 * Sends the Prompt message, if any.
 */
async function __handleFlowExecutePrompt (flow, recUser) {

	// Skip if there is no prompt to execute.
	if (!flow.definition.prompt) { return; }

	const MessageObject = this.__dep(`MessageObject`);

	// Figure out which text to use in the prompt message.
	const promptMessageText = this.__getFirstActivePromptText(flow.definition.prompt.text, recUser);
	if (!promptMessageText) {
		throw new Error(`The prompt in flow "${flow.uri}" does not include any message text to send.`);
	}

	const properties = { text: promptMessageText };
	let filteredOptions = [];

	// Filter the options by their conditionals, if any.
	if (flow.definition.prompt.options) {
		filteredOptions = this.__filterConditionalOptions(flow.definition.prompt.options, recUser);
	}

	// Add different properties to the message depending on the type of prompt.
	this.__addFlowPromptMessageProperties(flow, recUser, filteredOptions, properties);

	// Send the prompt message.
	const newMessage = MessageObject.outgoing(recUser, properties);
	await this.sendMessage(recUser, newMessage);

}

/*
 * Updates the conversation state for the given user in the database.
 */
async function __handleFlowUpdateConversationState (flow, recUser) {

	const database = this.__dep(`database`);
	let changes;

	// If we get this far with a basic flow and no prompt, then the conversation flow is finished.
	if (flow.definition.type === `basic` && !flow.definition.prompt) {
		changes = {
			'conversation.previousStepUri': recUser.conversation.currentStepUri,
			'conversation.currentStepUri': null,
			'conversation.waitingOnPrompt': false,
		};
	}

	// Otherwise, update the user record to mark that we're on this flow.
	else {
		changes = {
			'conversation.previousStepUri': recUser.conversation.currentStepUri,
			'conversation.currentStepUri': flow.uri,
			'conversation.waitingOnPrompt': Boolean(flow.definition.prompt),
		};
	}

	await database.update(`User`, recUser, changes);

}

/*
 * Executes the given flow for the given user.
 */
async function executeFlow (uri, recUser, message) {

	// Special errors will be thrown if we need to stop handling the prompt when we have finished successfully or failed.
	try {

		// Skip if the bot has been disabled for this user.
		if (this.skipIfBotDisabled(`execute conversation flow`, recUser)) {
			throw new Error(`STOP_NOT_COMPLETED`);
		}

		const sharedLogger = this.__dep(`sharedLogger`);
		const flow = this.__getFlow(uri);

		if (!flow) {
			throw new Error(`There is no flow defined for the URI "${uri}".`);
		}

		sharedLogger.silly(`Executing conversation flow "${flow.definition.uri}"...`);

		// Handle the different parts of the flow.
		await this.__handleFlowRedirectToNewFlow(flow, recUser, message);
		await this.__handleFlowExecuteActions(flow, recUser, message);
		await this.__handleFlowExecutePrompt(flow, recUser);
		await this.__handleFlowUpdateConversationState(flow, recUser);

	}
	catch (err) {

		switch (err.message) {
			case `STOP_SUCCESSFULLY_COMPLETED`: return true;
			case `STOP_NOT_COMPLETED`: return false;
			default: throw err; // Throw all other errors further up the stack.
		}

	}

	// If we get here then the flow must have been completed successfully.
	return true;

}

/*
 * Export.
 */
module.exports = {
	...loadingFlows,
	__getFlow,
	__getDynamicFlows,
	__handleFlowRedirectToNewFlow,
	__handleFlowExecuteActions,
	__addFlowPromptMessageProperties,
	__handleFlowExecutePrompt,
	__handleFlowUpdateConversationState,
	executeFlow,
};
