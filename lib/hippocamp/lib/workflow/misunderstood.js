'use strict';

/*
 * WORKFLOW: MISUNDERSTOOD
 * Functions for handling the case when the bot doesn't understand the user's input.
 */

/*
 * Sends a message to the user explaining that the bot doesn't know what they meant.
 */
async function sendMisunderstoodMessage (recUser, message) {

	const sharedLogger = this.__dep(`sharedLogger`);

	// Skip if the bot has been disabled for this user.
	if (this.skipIfBotDisabled(`send misunderstood message`, recUser)) {
		return false;
	}

	// Last ditch attempt to match the user's input.
	if (this.options.enableNlp) {
		const matchedCommand = await this.__findMatchingCommandByIntent(message.text, false);

		if (matchedCommand) {
			await this.__executeCommand(matchedCommand, message, recUser);
			return true;
		}
	}

	if (this.options.misunderstoodFlowUri) {
		await this.executeFlow(this.options.misunderstoodFlowUri, recUser, message);
		return true;
	}
	else if (this.options.misunderstoodText) {
		// Send the misunderstood text.
		const MessageObject = this.__dep(`MessageObject`);
		const misunderstoodMessage = MessageObject.outgoing(recUser, {
			text: this.options.misunderstoodText,
			options: this.options.misunderstoodOptions,
		});
		await this.sendMessage(recUser, misunderstoodMessage);
		// Misunderstood message sent.
		return true;
	}
	else { // We failed to match any commands AND there's no misunderstood text so we just ignore this situation.
		sharedLogger.verbose(`The misunderstood text is not configured so we won't send anything to the user.`);
		return false;
	}

}

/*
 * Export.
 */
module.exports = {
	sendMisunderstoodMessage,
};
