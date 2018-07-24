'use strict';

/*
 * MIDDLEWARE: Log Message
 */

const extender = require(`object-extender`);

module.exports = function logMessageMiddleware (sharedLogger) {

	// The actual middleware.
	return async (message, adapter, recUser, next/* , stop */) => {

		sharedLogger.debug({
			text: `Running middleware "logMessageMiddleware".`,
			direction: message.direction,
			message: message.text,
			userId: (recUser ? recUser._id.toString() : null),
			channelName: (recUser ? recUser.channel.name : null),
			channelUserId: (recUser ? recUser.channel.userId : null),
		});

		const messageClone = extender.clone(message);

		// Remove attachment data, if present. We don't want a huge data dump in the logs.
		if (Array.isArray(messageClone.attachments)) {
			messageClone.attachments.forEach(attachment => {
				if (attachment.data) { attachment.data = `<hidden>`; }
			});
		}

		// Log out!
		const logDirection = `${message.direction[0].toUpperCase()}${message.direction.substr(1)}`;
		await sharedLogger.debug({ text: `${logDirection} message`, message: messageClone });

		return next(null, recUser);

	};

};
