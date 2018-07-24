'use strict';

/*
 * MIDDLEWARE: Save Message
 */

const extender = require(`object-extender`);

module.exports = function saveMessageMiddleware (
	database, sharedLogger, triggerEvent, workflowManager, hippocampOptions
) {

	// The actual middleware.
	return async (message, adapter, recUser, next/* , stop */) => {

		sharedLogger.debug({
			text: `Running middleware "saveMessageMiddleware".`,
			direction: message.direction,
			message: message.text,
			userId: recUser._id.toString(),
			channelName: recUser.channel.name,
			channelUserId: recUser.channel.userId,
		});

		// Only if we haven't disabled saving messages.
		if (hippocampOptions.saveMessagesToDatabase) {

			// Create a raw copy of the message to save into the database.
			const messageClone = extender.clone(message);

			// Don't store attachment data in the database.
			if (messageClone.attachments) {
				messageClone.attachments.forEach(attachment => (attachment.data ? delete attachment.data : void (0)));
			}

			// Insert the new message.
			const recMessage = await database.insert(`Message`, {
				_user: recUser._id,
				direction: message.direction,
				sentAt: message.sentAt,
				sendDelay: message.sendDelay,
				humanToHuman: (recUser.bot && recUser.bot.disabled),
				batchable: message.batchable,
				data: messageClone,
			});

			// Add the record's message ID to the message object so we can use it later if needed.
			message.messageId = recMessage._id.toString();

		}

		// Update the last conversation timestamps on the user record.
		let timestampProperty;

		switch (message.direction) {
			case `incoming`: timestampProperty = `lastMessageReceivedAt`; break;
			case `outgoing`: timestampProperty = `lastMessageSentAt`; break;
			default: timestampProperty = null; break;
		}

		if (timestampProperty) {
			await database.update(`User`, recUser, {
				[`conversation.${timestampProperty}`]: Date.now(),
			});
		}

		// Track the message via the analytics handler.
		if (hippocampOptions.enableMessageTracking) {
			await workflowManager.trackMessage(recUser, message);
		}

		// Trigger event listeners.
		await triggerEvent(`new-${message.direction}-message`, { recUser, message });

		return next(null, recUser);

	};

};
