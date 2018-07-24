'use strict';

/*
 * MIDDLEWARE: Get Existing User
 */

module.exports = function getExistingUserMiddleware (database, sharedLogger) {

	// The actual middleware.
	return async (message, adapter, _recUser, next/* , stop */) => { // _recUser will be undefined as this is the first middleware in the chain.

		// Check if we have the given user in the database.
		const recUser = await database.get(`User`, {
			'channel.name': message.channelName,
			'channel.userId': message.channelUserId,
		});

		sharedLogger.debug({
			text: `Running middleware "getExistingUserMiddleware".`,
			direction: message.direction,
			message: message.text,
			userId: (recUser ? recUser._id.toString() : null),
			channelName: (recUser ? recUser.channel.name : null),
			channelUserId: (recUser ? recUser.channel.userId : null),
		});

		return next(null, recUser || null);

	};

};
