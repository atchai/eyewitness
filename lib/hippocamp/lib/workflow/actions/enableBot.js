'use strict';

/*
 * Enable the bot for the given user.
 */
module.exports = async function __executeActionEnableBot (action, recUser) {

	const database = this.__dep(`database`);
	const sharedLogger = this.__dep(`sharedLogger`);

	sharedLogger.debug({
		text: `Enabling bot for user.`,
		userId: recUser._id,
		firstName: recUser.profile.firstName,
		lastName: recUser.profile.lastName,
	});

	// Update the user record.
	recUser.bot = recUser.bot || {};
	recUser.bot.disabled = false;
	await database.update(`User`, recUser, { bot: { disabled: false } });

};
