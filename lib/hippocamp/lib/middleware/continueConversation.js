'use strict';

/*
 * MIDDLEWARE: Continue Conversation
 */

module.exports = function continueConversationMiddleware (database, sharedLogger, workflowManager) {

	// The actual middleware.
	return async (message, adapter, recUser, next, stop) => {

		sharedLogger.debug({
			text: `Running middleware "continueConversationMiddleware".`,
			direction: message.direction,
			message: message.text,
			userId: recUser._id.toString(),
			channelName: recUser.channel.name,
			channelUserId: recUser.channel.userId,
		});

		// Continue with the previous step and stop the flow here.
		if (recUser.conversation.waitingOnPrompt) {
			await workflowManager.handlePromptReply(message, recUser);
			return stop(null);
		}

		// If we get here then we don't understand the message.
		const sentMisunderstood = await workflowManager.sendMisunderstoodMessage(recUser, message);

		// Stop here if we sent the misunderstood message to the user, or otherwise continue on to the next middleware.
		if (sentMisunderstood) { return stop(null); }

		return next(null, recUser);

	};

};
