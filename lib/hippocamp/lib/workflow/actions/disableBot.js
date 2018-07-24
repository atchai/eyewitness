'use strict';

/*
 * Disable the bot for the given user.
 */
module.exports = async function __executeActionDisableBot (action, recUser) {

	const database = this.__dep(`database`);
	const sharedLogger = this.__dep(`sharedLogger`);

	sharedLogger.debug({
		text: `Disabling bot for user.`,
		userId: recUser._id,
		firstName: recUser.profile.firstName,
		lastName: recUser.profile.lastName,
	});

	// Update the user record.
	recUser.bot = recUser.bot || {};
	recUser.bot.disabled = true;
	await database.update(`User`, recUser, { bot: { disabled: true } });

};
