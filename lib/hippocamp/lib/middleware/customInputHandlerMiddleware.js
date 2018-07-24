'use strict';

/*
 * MIDDLEWARE: Custom Input Handler
 */

module.exports = function customInputHandlerMiddleware (sharedLogger, customInputHandlers) {

	// The actual middleware.
	return async (message, adapter, recUser, next, stop) => {

		sharedLogger.debug({
			text: `Running middleware "customInputHandlerMiddleware".`,
			direction: message.direction,
			message: message.text,
			userId: recUser._id.toString(),
			channelName: recUser.channel.name,
			channelUserId: recUser.channel.userId,
		});

		for (const inputHandler of Object.values(customInputHandlers)) {
			/*
			 * Run custom input handlers sequentially to avoid any possible conflicts
			 * with running in parellel as we do not know the implementation of each hanlder.
			 */
			if (await inputHandler.handleInput(message, recUser)) { // eslint-disable-line no-await-in-loop
				return stop(null);
			}
		}

		return next(null, recUser);

	};

};
