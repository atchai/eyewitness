'use strict';

/*
 * WORKFLOW: MEMORY
 * Functions for dealing with bot memory on a per-user basis.
 */

const extender = require(`object-extender`);
const deepProperty = require(`deep-property`);
const prepareMemoryChanges = require(`./prepareMemoryChanges`);

/*
 * Triggers events for the memory changes about to occur.
 */
function __triggerMemoryChangeEvents (recUser, memoryValues) {

	// Trigger events for any values that are changing.
	for (const key in memoryValues.set) {
		if (!memoryValues.set.hasOwnProperty(key)) { continue; }

		const oldValue = deepProperty.get(recUser, key); // Preserve the old value EXACTLY as it is (even undefined).
		const newValue = memoryValues.set[key];

		this.triggerEvent(`memory-change`, {
			recUser,
			memory: {
				key,
				operation: `set`,
				oldValue,
				newValue,
			},
		});
	}

	// Trigger events for any values that are being unset.
	for (const key in memoryValues.unset) {
		if (!memoryValues.unset.hasOwnProperty(key)) { continue; }

		const oldValue = deepProperty.get(recUser, key); // Preserve the old value EXACTLY as it is (even undefined).

		this.triggerEvent(`memory-change`, {
			recUser,
			memory: {
				key,
				operation: `unset`,
				oldValue,
				newValue: void (0),
			},
		});

	}

}

/*
 * We must also update the in-memory copy of the user record at the same time as we write changes to the database.
 */
function __updateInMemoryUserRecord (recUser, memoryValues) {

	// Overwrite any values that are changing.
	for (const key in memoryValues.set) {
		if (!memoryValues.set.hasOwnProperty(key)) { continue; }
		const value = memoryValues.set[key];
		deepProperty.set(recUser, key, value);
	}

	// Remove any values that are being unset.
	for (const key in memoryValues.unset) {
		if (!memoryValues.unset.hasOwnProperty(key)) { continue; }
		deepProperty.remove(recUser, key);
	}

}

/*
 * Prepares and updates the user's bot memory.
 */
async function updateUserMemory (input, memory, recUser, errorMessage) {

	const database = this.__dep(`database`);
	const variables = extender.merge(this.options.messageVariables, recUser.profile, recUser.appData);
	const memoryValues = this.prepareMemoryChanges(input, memory, recUser.appData, errorMessage, variables);

	// Trigger event listeners for each change (must be before the changes are made).
	this.__triggerMemoryChangeEvents(recUser, memoryValues);

	// Update the user record with the new memories.
	const changes = extender.merge(
		memoryValues.set,
		(Object.keys(memoryValues.unset).length ? { $unset: memoryValues.unset } : null)
	);

	this.__updateInMemoryUserRecord(recUser, memoryValues);
	await database.update(`User`, recUser, changes);

	return true;

}

/*
 * Removes all of the bot's memory for the given user, and optionally wipes the user's profile data too.
 */
async function __wipeUserMemory (wipeProfile, recUser) {

	const database = this.__dep(`database`);
	const dbChanges = { $set: {} };

	// Always wipe the app data.
	recUser.appData = {}; // In-memory user record.
	dbChanges.$set.appData = {}; // Database user record.

	// Always re-enable the bot.
	recUser.bot.disabled = false; // In-memory user record.
	dbChanges.$set[`bot.disabled`] = false; // Database user record.

	// Wipe the user's profile.
	if (wipeProfile) {
		const created = Date.now();
		recUser.profile = { created }; // In-memory user record.
		dbChanges.$set.profile = { created }; // Database user record.
	}

	// Update the user document in the database.
	await database.update(`User`, recUser, dbChanges);

}

/*
 * Export.
 */
module.exports = {
	__triggerMemoryChangeEvents,
	__updateInMemoryUserRecord,
	prepareMemoryChanges,
	updateUserMemory,
	__wipeUserMemory,
	...prepareMemoryChanges,
};
