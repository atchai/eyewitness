'use strict';

const makeRequest = require(`./makeRequest`);

/*
 * Mark the bot as typing or not typing for the given user.
 */
module.exports = async function setSenderAction (_senderAction, apiUri, channelUserId, resources) {

	let senderAction;

	switch (_senderAction) {
		case `TYPING_ON`: senderAction = `typing_on`; break;
		case `TYPING_OFF`: senderAction = `typing_off`; break;
		case `MESSAGES_READ`: senderAction = `mark_seen`; break;
		default: throw new Error(`Invalid sender action "${_senderAction}".`);
	}

	const postData = {
		recipient: {
			id: channelUserId,
		},
		sender_action: senderAction, // eslint-disable-line camelcase
		tag: `NON_PROMOTIONAL_SUBSCRIPTION`,
	};

	await makeRequest(apiUri, postData, resources);

};
