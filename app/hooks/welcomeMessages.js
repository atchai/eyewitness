'use strict';

/*
 * HOOK: Welcome Messages
 *
 * @deprecated - should no longer be required since we now have dynamic flow editing.
 */
module.exports = async function welcomeMessages (
	action, variables, { database, recUser, MessageObject, sendMessage, changeFlow }
) {

	// Load the welcome messages.
	const recWelcomeMessages = await database.find(`WelcomeMessage`, {}, {
		sort: { weight: `asc` },
	});

	// Send the default messages if the provider has not added any custom ones via the UI.
	if (!recWelcomeMessages || !recWelcomeMessages.length) {
		await changeFlow(`/introduction/default-welcome-messages`);
		return;
	}

	// Send all welcome messages in order.
	const chainStartsWith = Promise.resolve();
	const messagePromiseChain = recWelcomeMessages.reduce((chain, welcomeMessage) => {

		const message = new MessageObject({
			channelName: recUser.channel.name,
			channelUserId: recUser.channel.userId,
			direction: `outgoing`,
			text: welcomeMessage.text,
		});

		return chain.then(() => sendMessage(recUser, message)); // eslint-disable-line promise/prefer-await-to-then

	}, chainStartsWith);

	await messagePromiseChain;

};
