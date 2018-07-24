'use strict';

/*
 * MIDDLEWARE: Parse Command
 */

module.exports = function parseCommandMiddleware (database, sharedLogger, workflowManager) {

	// The actual middleware.
	return async (message, adapter, recUser, next, stop) => {

		sharedLogger.debug({
			text: `Running middleware "parseCommandMiddleware".`,
			direction: message.direction,
			message: message.text,
			userId: recUser._id.toString(),
			channelName: recUser.channel.name,
			channelUserId: recUser.channel.userId,
		});

		// If we successfully manage to execute a command lets break the middleware chain here.
		if (await workflowManager.handleCommandIfPresent(message, recUser)) { return stop(null); }

		// Otherwise continue.
		return next(null, recUser);

	};

};
