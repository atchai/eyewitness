'use strict';

const mime = require(`mime`);

/*
 * Convert the Facebook message to our internal representation.
 */
async function convertToInternalMessage (senderId, timestamp, fbMessage, resources) {

	const { MessageObject, populateOppositeUserId, handlerId } = resources;
	let attachments;

	// Deal with incoming attachments.
	if (fbMessage.attachments && fbMessage.attachments.length) {

		attachments = fbMessage.attachments.map(fbAttachment => {

			const payloadUrl = (fbAttachment.payload && fbAttachment.payload.url) || ``;
			let [ , filename ] = payloadUrl.match(/\/([a-z0-9\-_.]+)\?/i) || [];
			const mimeType = (filename ? mime.getType(filename) : void (0));
			let type;
			let remoteUrl = payloadUrl;

			switch (fbAttachment.type) {

				case `audio`: type = `audio`; break;
				case `file`: type = `file`; break;
				case `image`: type = `image`; break;
				case `video`: type = `video`; break;

				case `location`: {
					type = `location`;
					filename = fbAttachment.title;
					const [ , encodedMapUrl ] = fbAttachment.url.match(/\.php\?u=(.+)$/i);
					remoteUrl = decodeURIComponent(encodedMapUrl);
					break;
				}

				case `fallback`:
					type = `link`;
					filename = fbAttachment.title;
					remoteUrl = fbAttachment.url;
					break;

				default: throw new Error(`Unknown attachment type "${fbAttachment.type}" coming from Facebook.`);

			}

			return Object({
				type,
				filename: filename || `untitled`,
				mimeType,
				remoteUrl: remoteUrl || void (0),
			});

		});

	}

	// Construct the message.
	const properties = {
		direction: `incoming`,
		channelName: handlerId,
		channelUserId: senderId,
		channelMessageId: fbMessage.mid,
		referral: fbMessage.referral || null,
		sentAt: timestamp,
		text: (fbMessage.quick_reply && fbMessage.quick_reply.payload) || fbMessage.text || ``,
		attachments,
	};

	// Ensure we have the both the Hippocamp user ID and the channel user ID on the message.
	await populateOppositeUserId(properties);

	// Turn properties into a real message.
	return new MessageObject(properties);

}

/*
 * Collate and convert all incoming messages in the webhook into Hippocamp's internal message representation.
 */
module.exports = async function convertToInternalMessages (bodyData, resources) {

	const { sharedLogger } = resources;
	const messages = [];

	// No messages included? Nothing to do!
	if (!bodyData.entry || !bodyData.entry.length) { return messages; }

	// Collate messages.
	for (let entryIndex = 0; entryIndex < bodyData.entry.length; entryIndex++) {
		const entry = bodyData.entry[entryIndex];
		// const pageId = entry.id;
		const timestamp = entry.time;
		const messaging = entry.messaging || [];

		for (let messageIndex = 0; messageIndex < messaging.length; messageIndex++) {
			const event = messaging[messageIndex];
			const senderId = event.sender.id;

			// Read in messages and postbacks.
			if ((event.message && !event.message.is_echo) || event.postback) {
				let fbMessage;

				// If the event is a postback, convert it to a text message.
				if (event.postback) {
					fbMessage = {
						text: event.postback.payload,
						referral: event.postback.referral && event.postback.referral.ref,
					};
				}

				// Otherwise assume it's just a message.
				else {
					fbMessage = event.message;
				}

				// Convert the message to the internal representation.
				const message = await convertToInternalMessage(senderId, timestamp, fbMessage, resources); // eslint-disable-line no-await-in-loop
				messages.push(message);
			}

			else {
				sharedLogger.warn({
					text: `Unknown webhook from Facebook API.`,
					event,
				});
			}

		}

	}

	return messages;

};
