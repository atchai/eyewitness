'use strict';

/*
 * ADAPTER: Web
 */

const extender = require(`object-extender`);
const RequestNinja = require(`request-ninja`);
const AdapterBase = require(`./adapterBase`);

module.exports = class AdapterWeb extends AdapterBase {

	/*
	 * Instantiates the handler.
	 */
	constructor (_options) {

		// Configure the handler.
		super(`adapter`, `web`);

		// Default config for this handler.
		this.options = extender.defaults({
			accessToken: null,
			endpoint: null,
			paths: {
				threadSettings: null,
				typingStatus: null,
				readReceipts: null,
				sendMessage: null,
				userProfile: null,
			},
			supports: {
				whitelistedDomains: false,
				getStartedButton: false,
				greetingText: false,
				menu: false,
				typing: false,
				readReceipts: false,
				userProfiles: false,
			},
		}, _options);

		// Ensure paths begin with "/".
		Object.keys(this.options.paths).forEach(key => {
			const path = this.options.paths[key];
			return (!path || path[0] === `/` ? path : `/${path}`);
		});

		this.endpoint = this.options.endpoint;

	}

	/*
	 * Initialise this adapter.
	 */
	async init (hippocampOptions) {

		this.sendMessageDelay = hippocampOptions.sendMessageDelay;

		// Nothing to do if we don't have a thread settings path to POST to.
		if (!this.options.paths.threadSettings) { return; }

		const postData = {};

		if (this.options.supports.whitelistedDomains) {
			postData.whitelistedDomains = [ hippocampOptions.baseUrl ];
		}

		if (hippocampOptions.getStartedButton) {
			postData.getStartedButton = hippocampOptions.getStartedButton;
		}

		if (hippocampOptions.greetingText && this.options.supports.greetingText) {
			postData.greetingText = hippocampOptions.greetingText;
		}

		if (hippocampOptions.menu) {
			postData.menu = hippocampOptions.menu;
		}

		// Nothing to do.
		if (!Object.keys(postData).length) { return; }

		// Update the thread settings.
		await this.__makeRequest(this.options.paths.threadSettings, postData);

	}

	/*
	 * Handles an incoming request.
	 */
	async handleRequest (req, res) {

		switch (req.method.toLowerCase()) {
			case `post`: return await this.__receiveIncomingData(req, res);
			default: throw new Error(`Method "${req.method}" not supported.`);
		}

	}

	/*
	 * Collate and convert all incoming messages in the webhook into Hippocamp's internal message representation.
	 */
	async __processIncomingMessages (bodyData) {

		const MessageObject = this.__dep(`MessageObject`);
		const channelName = this.getHandlerId();
		const userBotsToDisable = {};

		const messagePromises = bodyData.messages.map(async _properties => {

			const defaultProperties = { direction: `incoming` };
			const readOnlyProperties = {};

			// Only allow channelName to be overridden if the message is marked as from an admin.
			if (bodyData.fromAdmin) {
				defaultProperties.channelName = channelName;
				readOnlyProperties.humanToHuman = true;
			}
			else {
				readOnlyProperties.channelName = channelName;
				readOnlyProperties.direction = `incoming`;
			}

			// Prepare message properties.
			const properties = extender.merge(defaultProperties, _properties, readOnlyProperties);
			const message = new MessageObject(properties);

			// Ensure we have the both the Hippocamp user ID and the channel user ID on the message.
			const messageUserRecord = await this.populateOppositeUserId(message);

			// Store the user record on the message for later use.
			if (bodyData.fromAdmin) { userBotsToDisable[message.userId] = messageUserRecord; }
			message.recUser = messageUserRecord;

			return message;

		});

		const messages = await Promise.all(messagePromises);

		return {
			messages,
			userBotsToDisable,
		};

	}

	/*
	 * Handles incoming data from a webhook.
	 */
	async __receiveIncomingData (req, res) {

		const sharedLogger = this.__dep(`sharedLogger`);
		let messages;
		let userBotsToDisable;

		// Ensure incoming messages are sane.
		try {
			const result = await this.__processIncomingMessages(req.body);
			messages = result.messages;
			userBotsToDisable = result.userBotsToDisable;
		}
		catch (err) {
			res.status(500).respond({ success: false, error: `Incoming message in the Web API is not sane.` });
			return;
		}

		// Tell the Web API we received the webhook successfully.
		res.status(200).respond({ success: true });

		// Mark the thread as read (but don't wait for it to succeed).
		if (messages && messages.length) {
			this.markAsRead(messages[0].channelUserId);
		}

		// Disable any users that were sent a message by an admin.
		const userBotsToDisablePromises = Object.values(userBotsToDisable).map(recUser =>
			this.setBotDisabledForUser(recUser, true)
		);

		await Promise.all(userBotsToDisablePromises);

		// Process each message in turn.
		const adapter = {
			sendMessage: this.sendMessage.bind(this),
			getUserProfile: this.getUserProfile.bind(this),
		};
		const chainStartsWith = Promise.resolve();

		const promiseChain = messages.reduce(
			(chain, message) => {

				if (message.direction === `outgoing`) {
					return chain.then(() => this.sendMessage(message.recUser, message)); // eslint-disable-line promise/prefer-await-to-then
				}

				else {
					if (message.recUser) { delete message.recUser; }
					return chain.then(() => this.__executeHandler(`incoming-message`, message, adapter)); // eslint-disable-line promise/prefer-await-to-then
				}

			},
			chainStartsWith
		);

		// Wait for all the messages to be processed.
		try {
			await promiseChain;
		}
		catch (err) {
			sharedLogger.error(err);
		}

	}

	/*
	 * Mark the bot as typing for the given user.
	 */
	async markAsTypingOn (recUser) {

		// Nothing to do if we don't have an endpoint for typing status.
		if (!this.options.supports.typing || !this.options.paths.typingStatus) { return; }

		await this.__makeRequest(this.options.paths.typingStatus, {
			channelUserId: recUser.channel.userId,
			typingStatus: true,
		});

	}

	/*
	 * Mark the bot as not typing for the given user.
	 */
	async markAsTypingOff (recUser) {

		// Nothing to do if we don't have an endpoint for typing status.
		if (!this.options.supports.typing || !this.options.paths.typingStatus) { return; }

		await this.__makeRequest(this.options.paths.typingStatus, {
			channelUserId: recUser.channel.userId,
			typingStatus: false,
		});

	}

	/*
	 * Mark the bot as read the incoming messages for the given user.
	 */
	async markAsRead (channelUserId) {

		// Nothing to do if we don't have an endpoint for typing status.
		if (!this.options.supports.readReceipts || !this.options.paths.readReceipts) { return; }

		await this.__makeRequest(this.options.paths.readReceipts, {
			channelUserId: channelUserId,
		});

	}

	/*
	 * Sends a single message to the given user ID.
	 */
	async sendMessage (recUser, message) {

		const sharedLogger = this.__dep(`sharedLogger`);

		// Do NOT include the user record on the message when we send it out!
		if (message.recUser) { delete message.recUser; }

		// Do we need to send the message via another adapter?
		if (message.channelName !== this.getHandlerId()) {
			return await this.sendMessageViaAnotherAdapter(recUser, message);
		}

		// Run outgoing middleware and start typing.
		await this.__executeHandler(`outgoing-message`, message, null);

		// Wait for the message to complete sending.
		try {
			await this.__makeRequest(this.options.paths.sendMessage, message);
		}
		catch (err) {
			sharedLogger.error(`Failed to send messages via the Web API because of "${err}".`);
			sharedLogger.error(err);
		}

		// Consistent return.
		return null;

	}

	/*
	 * Makes a request to the Web API.
	 */
	async __makeRequest (path, postData) {

		const sharedLogger = this.__dep(`sharedLogger`);
		sharedLogger.silly({
			text: `Making a request to the Web API.`,
			postData,
		});

		const req = new RequestNinja(`${this.endpoint}${path}?accessToken=${this.options.accessToken}`, {
			timeout: (1000 * 30),
			returnResponseObject: true,
		});
		let res;

		// We need to POST some data.
		if (postData) {
			res = await req.postJson(postData);
		}
		else {
			res = await req.get();
		}

		const data = res.body;

		if (data.error) {
			throw new Error(`Message rejected by Web API with error: "${data.error.message}".`);
		}
		else if (res.statusCode !== 200) {
			throw new Error(`Encountered a non-200 HTTP status code: "${res.statusCode}".`);
		}

		return data;

	}

	/*
	 * Returns the user's profile as a JSON object.
	 */
	async getUserProfile (channelUserId) {

		if (this.options.paths.profileLoaded) {
			await this.__makeRequest(this.options.paths.profileLoaded, {
				profileLoaded: true,
				channelUserId: channelUserId,
			});
		}

		// The Web API does not support user profiles.
		if (!this.options.supports.userProfiles) {
			return null;
		}

		const webProfile = await this.__makeRequest(`${this.options.paths.userProfile}/${channelUserId}`);

		// Don't return empty profile fields if there is no profile!
		if (!webProfile) {
			return null;
		}

		// Map the Web profile to the internal profile.
		return {
			firstName: webProfile.firstName || null,
			lastName: webProfile.lastName || null,
			gender: webProfile.gender || null,
			email: webProfile.email || null,
			tel: webProfile.tel || null,
			profilePicUrl: webProfile.profilePicUrl || null,
			timezoneUtcOffset: webProfile.timezoneUtcOffset || null,
			age: null,
		};

	}

};
