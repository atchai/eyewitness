'use strict';

/*
 * Send the given message using the given sendMessage method (which will be primed with the user ID).
 */
module.exports = async function __executeActionSendMessage (action, recUser) {

	if (!recUser) { throw new Error(`Cannot execute action "send message" unless a user is provided.`); }

	const MessageObject = this.__dep(`MessageObject`);
	const newMessage = MessageObject.outgoing(recUser, action.message);

	await this.sendMessage(recUser, newMessage);

};
