'use strict';

/* eslint filenames/no-index: 0 */

/*
 * ADAPTER: Facebook
 */

const extender = require(`object-extender`);
const AdapterBase = require(`../adapterBase`);
const convertToInternalMessages = require(`./convertToInternalMessages`);
const convertToFacebookPersistentMenu = require(`./convertToFacebookPersistentMenu`);
const makeRequest = require(`./makeRequest`);
const sendMessage = require(`./sendMessage`);
const setSenderAction = require(`./setSenderAction`);
const { validateVerifyToken } = require(`./miscellaneous`);

module.exports = class AdapterFacebook extends AdapterBase {

	/*
	 * Instantiates the handler.
	 */
	constructor (_options) {

		// Configure the handler.
		super(`adapter`, `facebook`);

		// Default config for this handler.
		this.options = extender.defaults({
			verifyToken: null,
			accessToken: null,
		}, _options);

		this.endpoint = `https://graph.facebook.com/v2.6`;

		this.messageBatching = {
			maxQueueSize: 50,
			queueFlushIntervalMs: 500,
			timeoutId: null,
			queue: [],
		};

	}

	/*
	 * Initialise the adapter and set some thread settings.
	 */
	async init (hippocampOptions) {

		this.sendMessageDelay = hippocampOptions.sendMessageDelay;

		const postData = {
			whitelisted_domains: hippocampOptions.whitelistedDomains || [ hippocampOptions.baseUrl ], // eslint-disable-line camelcase
		};

		if (hippocampOptions.getStartedButton) {
			postData.get_started = { payload: hippocampOptions.getStartedButton }; // eslint-disable-line camelcase
		}

		if (hippocampOptions.greetingText) {
			postData.greeting = [{ locale: `default`, text: hippocampOptions.greetingText }];
		}

		if (hippocampOptions.menu) {
			postData.persistent_menu = [{ // eslint-disable-line camelcase
				locale: `default`,
				call_to_actions: convertToFacebookPersistentMenu(hippocampOptions.menu), // eslint-disable-line camelcase
				composer_input_disabled: !hippocampOptions.allowUserTextReplies, // eslint-disable-line camelcase
			}];
		}

		// Nothing to do.
		if (!Object.keys(postData).length) { return; }

		// Update the thread settings.
		const sharedLogger = this.__dep(`sharedLogger`);
		const apiUri = this.__constructFacebookApiUri(`/me/messenger_profile`);
		const makeRequestResources = {
			sharedLogger,
			markBotRemovedForUserByChannel: this.markBotRemovedForUserByChannel.bind(this), // Maintain 'this' scope.
		};

		try {
			await makeRequest(apiUri, postData, makeRequestResources);
		}
		catch (err) {
			throw new Error(`Failed to initialise the "${this.getHandlerId()}" adapter because of "${err}".`);
		}

	}

	/*
	 * Returns a fully-formed Facebook API URI.
	 */
	__constructFacebookApiUri (path) {
		return `${this.endpoint}${path}?access_token=${this.options.accessToken}`;
	}

	/*
	 * Handles an incoming request.
	 */
	async handleRequest (req, res) {

		switch (req.method.toLowerCase()) {
			case `get`: return validateVerifyToken(req, res, this.options.verifyToken);
			case `post`: return await this.__receiveIncomingData(req, res);
			default: throw new Error(`Method "${req.method}" not supported.`);
		}

	}

	/*
	 * Processes each incoming messaged in turn.
	 */
	async __processIncomingMessages (messages) {

		const sharedLogger = this.__dep(`sharedLogger`);

		// Process each message in turn.
		const adapter = {
			sendMessage: this.sendMessage.bind(this),
			getUserProfile: this.getUserProfile.bind(this),
		};
		const promiseChain = messages.reduce(
			(chain, message) => chain.then(() => this.__executeHandler(`incoming-message`, message, adapter)), // eslint-disable-line promise/prefer-await-to-then
			Promise.resolve()
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
	 * Handles incoming data from a webhook.
	 */
	async __receiveIncomingData (req, res) {

		if (req.body.object !== `page`) {
			res.status(501).respond();
			return;
		}

		const sharedLogger = this.__dep(`sharedLogger`);
		const conversionResources = {
			sharedLogger,
			MessageObject: this.__dep(`MessageObject`),
			populateOppositeUserId: this.populateOppositeUserId.bind(this), // Maintain 'this' scope.
			handlerId: this.getHandlerId(),
		};
		let messages;

		// Attempt to parse the incoming messages.
		try {
			messages = await convertToInternalMessages(req.body, conversionResources);
		}
		catch (err) {
			sharedLogger.error(`Failed to process incoming Facebook messages because of "${err}".`);
			res.status(500).respond();
			return;
		}

		// Tell Facebook we received the webhook successfully.
		res.status(200).respond();

		// If there are messages we have nothing more to do.
		if (!messages || !messages.length) { return; }

		// Mark the thread as read (but don't wait for it to succeed).
		this.markAsRead(messages[0].channelUserId);

		// Process messages.
		await this.__processIncomingMessages(messages);

	}

	/*
	 * Mark the bot as typing for the given user.
	 */
	async markAsTypingOn (recUser) {

		const apiUri = this.__constructFacebookApiUri(`/me/messages`);
		const makeRequestResources = {
			sharedLogger: this.__dep(`sharedLogger`),
			markBotRemovedForUserByChannel: this.markBotRemovedForUserByChannel.bind(this), // Maintain 'this' scope.
		};

		await setSenderAction(`TYPING_ON`, apiUri, recUser.channel.userId, makeRequestResources);

	}

	/*
	 * Mark the bot as not typing for the given user.
	 */
	async markAsTypingOff (recUser) {

		const apiUri = this.__constructFacebookApiUri(`/me/messages`);
		const makeRequestResources = {
			sharedLogger: this.__dep(`sharedLogger`),
			markBotRemovedForUserByChannel: this.markBotRemovedForUserByChannel.bind(this), // Maintain 'this' scope.
		};

		await setSenderAction(`TYPING_OFF`, apiUri, recUser.channel.userId, makeRequestResources);

	}

	/*
	 * Mark the bot as read the incoming messages for the given user.
	 */
	async markAsRead (channelUserId) {

		const apiUri = this.__constructFacebookApiUri(`/me/messages`);
		const makeRequestResources = {
			sharedLogger: this.__dep(`sharedLogger`),
			markBotRemovedForUserByChannel: this.markBotRemovedForUserByChannel.bind(this), // Maintain 'this' scope.
		};

		await setSenderAction(`MESSAGES_READ`, apiUri, channelUserId, makeRequestResources);

	}

	/*
	 * Sends a single message to the given user ID.
	 */
	async sendMessage (recUser, message) {

		const resources = {
			sharedLogger: this.__dep(`sharedLogger`),
			MessageObject: this.__dep(`MessageObject`),
			apiUri: this.__constructFacebookApiUri(`/me/messages`),
			executeOutgoingMessageMiddleware: this.__executeHandler.bind(this, `outgoing-message`),
		};

		await sendMessage(recUser, message, this.messageBatching, resources);

	}

	/*
	 * Returns the user's profile as a JSON object, or null if no profile could be found.
	 */
	async getUserProfile (channelUserId) {

		const sharedLogger = this.__dep(`sharedLogger`);
		const apiUri = this.__constructFacebookApiUri(`/${channelUserId}`);
		const makeRequestResources = {
			sharedLogger,
			markBotRemovedForUserByChannel: this.markBotRemovedForUserByChannel.bind(this), // Maintain 'this' scope.
		};
		let fbProfile;

		try {
			const batchResults = await makeRequest(apiUri, null, makeRequestResources);
			fbProfile = batchResults[0];
		}
		catch (err) {
			sharedLogger.error(`Failed to get user profile from Facebook because of "${err.message}".`);
			sharedLogger.error(err);
			return null;
		}

		// Don't return empty profile fields if there is no profile!
		if (!fbProfile) {
			return null;
		}

		// Map the Facebook profile to the internal profile fields.
		return {
			firstName: fbProfile.first_name || null,
			lastName: fbProfile.last_name || null,
			gender: fbProfile.gender || null,
			timezoneUtcOffset: fbProfile.timezone || null,
			profilePicUrl: fbProfile.profile_pic || null,
			email: null,
			tel: null,
			age: null,
		};

	}

};
