'use strict';

/*
 * Update the in-memory user record AND the database with the new (blank) memories.
 */
module.exports = async function __executeActionWipeMemory (action, recUser) {

	if (!recUser) { throw new Error(`Cannot execute action "wipe memory" unless a user is provided.`); }

	const database = this.__dep(`database`);
	const scheduler = this.__dep(`scheduler`);
	const wipeProfile = (typeof action.wipeProfile === `undefined` ? true : action.wipeProfile);
	const wipeMessages = (typeof action.wipeMessages === `undefined` ? true : action.wipeMessages);

	await this.__wipeUserMemory(wipeProfile, recUser);

	// Wipe the user's messages.
	if (wipeMessages) { await database.deleteWhere(`Message`, { _user: recUser._id }); }

	// Remove all scheduled tasks.
	if (scheduler) { await scheduler.removeAllTasksForUser(recUser._id); }

};
