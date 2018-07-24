'use strict';

/*
 * HOOK: $userinfo
 */

/* eslint no-cond-assign: 0 */

module.exports = async function userinfo (action, variables, { MessageObject, recUser, sendMessage }) {

	// General user info.
	const messageGeneralInfo = MessageObject.outgoing(recUser, {
		text: [
			`User ID: ${recUser._id}`,
		].join(`\n`),
	});

	await sendMessage(recUser, messageGeneralInfo);

	// User profile info.
	const messageChannelInfo = MessageObject.outgoing(recUser, {
		text: [
			`Channel:`,
			JSON.stringify(recUser.channel, null, 2),
		].join(`\n`),
	});

	await sendMessage(recUser, messageChannelInfo);
	// User profile info.
	const messageUserProfile = MessageObject.outgoing(recUser, {
		text: [
			`Profile:`,
			JSON.stringify(recUser.profile, null, 2),
		].join(`\n`),
	});

	await sendMessage(recUser, messageUserProfile);

	// App data - split into chunks of 500 chars each.
	const maxLen = 500;
	const fullAppDataText = [
		`App Data:`,
		JSON.stringify(recUser.appData || {}, null, 2),
	].join(`\n`);
	let nextChunk;
	let index = 0;
	const appDataTextParts = [];

	while (nextChunk = fullAppDataText.substr(index, maxLen)) {
		appDataTextParts.push(nextChunk);
		index += maxLen;
	}

	// Send the app data chunks in order.
	await appDataTextParts.reduce((chain, chunk) => {

		const messagAppData = MessageObject.outgoing(recUser, {
			text: chunk,
		});

		return chain.then(() => sendMessage(recUser, messagAppData));

	}, Promise.resolve());

};
