'use strict';

/*
 * MIDDLEWARE: Track User
 */

module.exports = function trackUserMiddleware (database, sharedLogger, workflowManager, hippocampOptions) {

	// The actual middleware.
	return async (message, adapter, recUser, next/* , stop */) => {

		sharedLogger.debug({
			text: `Running middleware "trackUserMiddleware".`,
			direction: message.direction,
			message: message.text,
			userId: recUser._id.toString(),
			channelName: recUser.channel.name,
			channelUserId: recUser.channel.userId,
		});

		// Skip if the user tracking functionality has been disabled.
		if (!hippocampOptions.enableUserTracking) { return next(null, recUser); }

		// Identify the user to the analytics provider.
		await workflowManager.trackUser(recUser);

		return next(null, recUser);

	};

};
