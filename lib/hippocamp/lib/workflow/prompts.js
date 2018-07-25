'use strict';

/*
 * WORKFLOW: PROMPTS
 * Functions for dealing with sending prompts and parsing user responses.
 */

const extender = require(`object-extender`);

/*
 * Returns the first conditionally active prompt text.
 */
function __getFirstActivePromptText (promptText, recUser) {

	const variables = extender.merge(this.options.messageVariables, recUser.profile, recUser.appData);
	const foundItem = promptText.find(item => this.evaluateConditional(item.conditional, variables));

	return (foundItem ? foundItem.value : null);

}

/*
 * Returns the flow and prompt that we need to handle the response for.
 */
function __getPromptFlow (recUser) {

	const flow = this.__getFlow(recUser.conversation.currentStepUri);

	if (!flow) {
		throw new Error(`There is no conversation flow to handle the prompt reply at the URI "${recUser.conversation.currentStepUri}".`);
	}

	return { flow, prompt: flow.definition.prompt };

}

/*
 * Check which of the options the user chose, if any.
 */
async function __handlePromptReplyOptions (input, recUser, prompt, errorMessage) {

	const MessageObject = this.__dep(`MessageObject`);
	let nextUri = null;

	// If the prompt reply to options is not a message then we have a big bug!
	if (!(input instanceof MessageObject)) {
		throw new Error(`Cannot handle prompt reply options if the input is not a message.`);
	}

	const filteredOptions = this.__filterConditionalOptions(prompt.options, recUser);
	let optionDidMatch = false;

	// The first option that matches wins!
	for (let oindex = 0; oindex < filteredOptions.length; oindex++) {
		const optionDefinition = filteredOptions[oindex];
		const textMatches = await this.doesTextMatch(optionDefinition.matches, input.text); // eslint-disable-line no-await-in-loop

		if (textMatches) {
			nextUri = optionDefinition.nextUri || null;
			optionDidMatch = true;
			break;
		}
	}

	// If no options matched and we are an options prompt, send the validation error and repeat the options.
	if (!optionDidMatch && prompt.type === `options`) {
		const validationErrorMessage = MessageObject.outgoing(recUser, {
			text: errorMessage,
			options: filteredOptions,
		});

		await this.sendMessage(recUser, validationErrorMessage);
		throw new Error(`STOP_SUCCESSFULLY_HANDLED`);
	}

	return nextUri;

}

/*
 * Check the correct data came back from the webview and the user didn't send a message instead.
 */
async function __handlePromptReplyWebview (input, recUser, prompt, uri, errorMessage) {

	// Not a webview prompt.
	if (prompt.type !== `webview`) { return; }

	const MessageObject = this.__dep(`MessageObject`);

	// The user has sent a message instead of interacting with the webview.
	if (input instanceof MessageObject) {
		const validationErrorMessage = MessageObject.outgoing(recUser, {
			text: errorMessage,
			buttons: [ this.__getWebviewOpenButtonDefinition(uri, recUser, prompt) ],
		});

		await this.sendMessage(recUser, validationErrorMessage);
		throw new Error(`STOP_SUCCESSFULLY_HANDLED`);
	}

}

/*
 * Save the prompt reply to memory, if necessary.
 */
async function __handlePromptReplyMemory (input, recUser, prompt, errorMessage) {

	// We are not updating bot's memory with this prompt's answer.
	if (!prompt.memory) { return; }

	const MessageObject = this.__dep(`MessageObject`);
	const sharedLogger = this.__dep(`sharedLogger`);

	try {
		if (!input.text && input.attachments && input.attachments.length) { input.text = `-attachment-`; }
		await this.updateUserMemory(input, prompt.memory, recUser, errorMessage);
	}
	catch (err) {

		const validationErrorMessage = MessageObject.outgoing(recUser, {
			text: err.message,
			options: prompt.options,
		});

		await this.sendMessage(recUser, validationErrorMessage);
		sharedLogger.error(`Failed to update bot memory with prompt reply because of "${err}".`);
		throw new Error(`STOP_NOT_HANDLED`);

	}

}

/*
 * Track an event with the prompt answer.
 */
async function __handlePromptReplyTracking (input, recUser, prompt) {

	// Not tracking the answer of this prompt.
	if (!prompt.trackResponse) { return; }

	const eventName = (prompt.trackResponse.eventName || ``).trim() || `user-response`;
	const fieldName = (prompt.trackResponse.fieldName || ``).trim() || `response`;

	await this.trackEvent(recUser, eventName, {
		[fieldName]: input.text,
	});

}

/*
 * Handles the reply to a prompt within the current flow and returns true if the prompt was handled correctly. The
 * input may either be a message or the form data from a webview form submission.
 */
async function handlePromptReply (input, recUser) {

	// Special errors will be thrown if we need to stop handling the prompt when we have finished successfully or failed.
	try {

		// Skip if the bot has been disabled for this user.
		if (this.skipIfBotDisabled(`handle prompt reply`, recUser)) {
			throw new Error(`STOP_NOT_HANDLED`);
		}

		const { flow, prompt } = this.__getPromptFlow(recUser);

		// There is no current prompt, so waitingOnPrompt must have been set by a hook.
		if (typeof prompt === `undefined`) {
			await this.executeFlow(flow.uri, recUser, input);
			return false;
		}

		const errorMessage = prompt.errorMessage || `Whoops! I didn't understand what you said.`;

		// Handle the different parts of the prompt.
		const optionsNextUri = await this.__handlePromptReplyOptions(input, recUser, prompt, errorMessage);
		await this.__handlePromptReplyWebview(input, recUser, prompt, flow.uri, errorMessage);
		await this.__handlePromptReplyMemory(input, recUser, prompt, errorMessage);
		await this.__handlePromptReplyTracking(input, recUser, prompt);

		// Are we moving to a new flow?
		const nextUri = optionsNextUri || prompt.nextUri || null;

		if (nextUri) {
			await this.executeFlow(nextUri, recUser, input);
			return true;
		}

	}
	catch (err) {

		switch (err.message) {
			case `STOP_SUCCESSFULLY_HANDLED`: return true;
			case `STOP_NOT_HANDLED`: return false;
			default: throw err; // Throw all other errors further up the stack.
		}

	}

	// If we get here then the prompt must have been handled successfully.
	return true;

}

/*
 * Export.
 */
module.exports = {
	__getFirstActivePromptText,
	__getPromptFlow,
	__handlePromptReplyOptions,
	__handlePromptReplyWebview,
	__handlePromptReplyMemory,
	__handlePromptReplyTracking,
	handlePromptReply,
};
