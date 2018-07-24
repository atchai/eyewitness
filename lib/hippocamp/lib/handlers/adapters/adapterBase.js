'use strict';

/*
 * ADAPTER BASE
 */

const HandlerBase = require(`../handlerBase`);
const utilities = require(`../../modules/utilities`);

module.exports = class AdapterBase extends HandlerBase {

	/*
	 * Instantiates a new adapter handler.
	 */
	constructor (type, handlerId) {
		super(type, handlerId, { chainMiddlewareResults: true });
	}

	/*
	 * If the message only contains the channelName and channelUserId properties we need to add the Hippocamp user ID to
	 * it, and if it only contains the userId, we need to add channelName and channelUserId. Modifies the message object
	 * in-place and returns the user record.
	 */
	async populateOppositeUserId (message) {

		let recUser;

		// Get the user record.
		if (message.userId) {
			recUser = await this.getUserById(message.userId);
		}
		else {
			recUser = await this.getUserByChannel(message.channelName, message.channelUserId);
		}

		// Ensure we have all the user IDs on the message object.
		if (recUser) {
			message.userId = recUser._id.toString();
			message.channelName = recUser.channel.name;
			message.channelUserId = recUser.channel.userId;
		}

		return recUser;

	}

	/*
	 * Returns the given user that matches the channel information.
	 */
	async getUserByChannel (channelName, channelUserId) {

		const database = this.__dep(`database`);

		return await database.get(`User`, {
			'channel.name': channelName,
			'channel.userId': channelUserId,
		});

	}

	/*
	 * Returns the given user by their Hippocamp user ID.
	 */
	async getUserById (userId) {

		const database = this.__dep(`database`);

		return await database.get(`User`, {
			_id: userId,
		});

	}

	/*
	 * Updates the "bot.disabled" property for the given user (where input is a user ID or full user record).
	 */
	async setBotDisabledForUser (input, disabled) {

		const database = this.__dep(`database`);

		return await database.update(`User`, input, {
			'bot.disabled': disabled,
		});

	}

	/*
	 * Makes the given user's bot as "removed" so we don't consider the user for sending messages in future.
	 */
	async markBotRemovedForUser (input) {

		const database = this.__dep(`database`);

		return await database.update(`User`, input, {
			'bot.removed': true,
		});

	}

	/*
	 * Makes the given user's bot as "removed" so we don't consider the user for sending messages in future.
	 */
	async markBotRemovedForUserByChannel (channelUserId, _channelName = null) {

		const channelName = _channelName || this.getHandlerId();

		return await this.markBotRemovedForUser({
			'channel.name': channelName,
			'channel.userId': channelUserId,
		});

	}

	/*
	 * Allows a message to be sent via the adapter specified in the message in the "channelName" property.
	 */
	async sendMessageViaAnotherAdapter (input, message) {

		const adapters = this.__dep(`adapters`);
		const recUser = await (input._id ? input : this.getUserByChannel(input));
		const otherAdapter = adapters[message.channelName];

		if (!otherAdapter) {
			throw new Error(`Cannot sent message via other adapter "${message.channelName}" because it does not exist.`);
		}

		// Figure out the message send delay.
		message.sendDelay = utilities.calculateSendMessageDelay(message, this.sendMessageDelay);

		await otherAdapter.markAsTypingOn(recUser);
		await utilities.delay(message.sendDelay);
		return await otherAdapter.sendMessage(recUser, message);

	}

};
