'use strict';

/*
 * MIDDLEWARE: Mark As Human To Human
 */

module.exports = function markAsHumanToHumanMiddleware (database, sharedLogger, hippocampOptions) {

	// The actual middleware.
	return async (message, adapter, recUser, next/* , stop */) => {

		// Skip this middleware if we actually have a misunderstood text and still managed to get here.
		if (hippocampOptions.misunderstoodText) { return next(null, recUser); }

		sharedLogger.debug({
			text: `Running middleware "markAsHumanToHumanMiddleware".`,
			direction: message.direction,
			message: message.text,
			userId: recUser._id.toString(),
			channelName: recUser.channel.name,
			channelUserId: recUser.channel.userId,
		});

		// Mark the message as human to human.
		message.humanToHuman = true;
		await database.update(`Message`, message.messageId, {
			humanToHuman: true,
		});

		return next(null, recUser);

	};

};
