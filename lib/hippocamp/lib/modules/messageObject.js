'use strict';

/*
 * MESSAGE OBJECT
 */

const mime = require(`mime`);
const moment = require(`moment`);

module.exports = class MessageObject {

	/*
	 * Instantiate a new message.
	 */
	constructor (inputProperties) {

		const defaultProperties = {
			direction: null,
			userId: null,
			channelName: null,
			channelUserId: null,
			channelMessageId: null,
			sendDelay: null,
			humanToHuman: null,
			batchable: false,
			referral: null,
			fromAdmin: null,
			sentAt: new Date(),
			text: ``,
			options: null,
			buttons: null,
			carousel: null,
			attachments: null,
		};

		// Add in each allowed property in turn transforming them if necessary.
		for (const key in defaultProperties) {
			if (!defaultProperties.hasOwnProperty(key)) { continue; }

			const input = inputProperties[key];
			let value;

			// Property was not set.
			if (typeof input === `undefined`) { continue; }

			// Prerpare the property's value.
			switch (key) {

				case `text`:
					value = (input || defaultProperties[key] || ``).trim();
					break;

				case `sentAt`:
					value = moment(input || defaultProperties[key]).toDate();
					break;

				case `options`:
					if (input && !Array.isArray(input)) { throw new Error(`The "options" property must be an array.`); }

					// Check each option.
					value = input.map(option => {
						if (!option.label) { throw new Error(`All options must have a label!`); }
						return option;
					});
					break;

				case `buttons`:
					if (input && !Array.isArray(input)) { throw new Error(`The "options" property must be an array.`); }

					// Check each button.
					value = input.map(button => {
						if (!button.label) { throw new Error(`All buttons must have a label!`); }
						button.type = button.type || `basic`;
						return button;
					});
					break;

				case `attachments`:
					if (input && !Array.isArray(input)) { throw new Error(`The "attachments" property must be an array.`); }

					// Check each attachment, add missing mime types and convert data to buffers.
					value = input.map(attachment => {

						if (!attachment.filename) { throw new Error(`All attachments must have a filename!`); }

						attachment.type = attachment.type || `file`;
						attachment.mimeType = attachment.mimeType || mime.getType(attachment.filename);

						if (attachment.data) {
							attachment.data = Buffer.from(attachment.data);
						}
						else if (!attachment.remoteUrl) {
							throw new Error(`Attachments must have either "data" or "remoteUrl" set.`);
						}

						return attachment;

					});
					break;

				// All other properties can just be added directly without being transformed.
				default:
					value = inputProperties[key];
					break;

			}

			// Set the prepared value on this message.
			this[key] = value;

		}

		// Check for required properties.
		if (!this.direction) { throw new Error(`The "direction" property is always required for messages.`); }
		if (!this.userId && (!this.channelName || !this.channelUserId)) {
			throw new Error(`Messages always require either "userId" or "channelName" and "channelUserId" properties.`);
		}

		if (
			!this.text &&
			(!Array.isArray(this.options) || !this.options.length) &&
			(!Array.isArray(this.buttons) || !this.buttons.length) &&
			(!Array.isArray(this.attachments) || !this.attachments.length) &&
			!this.carousel
		) {
			throw new Error(
				`The "text" propery is required for messages that don't have options, buttons, attachments or a carousel.`
			);
		}

	}

	/**
	 * Static factory method for constructing an outgoing MessageObject.
	 *
	 * @param {Object} recUser - User record
	 * @param {Object} options - Options for the new MessageObject. Direction and user options are filled automatically
	 * @returns {module.MessageObject} A new outgoing MessageObject with given options.
	 */
	static outgoing (recUser, options = {}) {
		options.direction = `outgoing`;
		options.channelName = recUser.channel.name;
		options.channelUserId = recUser.channel.userId;
		return new MessageObject(options);
	}

};
