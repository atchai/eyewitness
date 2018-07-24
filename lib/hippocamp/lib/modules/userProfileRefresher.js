'use strict';

const moment = require(`moment`);

/*
 * Returns true if we are allowed to refresh the user's profile at this time.
 */
function isAllowedToRefresh (recUser, refreshEvery) {

	const [ refreshFrequency, refreshUnits ] = (refreshEvery ? refreshEvery.split(/\s+/g) : [ null, null ]);

	// If we have loaded the user profile at least once, and the config is set to refresh never.
	if (recUser.profile.lastUpdated > 0 && (!refreshFrequency || !refreshUnits)) {
		return false;
	}

	const diffFrequency = moment.utc().diff(moment.utc(recUser.profile.lastUpdated), refreshUnits, true);

	// If we have loaded the user profile at least once, and we have not reached the next refresh time yet.
	if (recUser.profile.lastUpdated > 0 && diffFrequency <= parseFloat(refreshFrequency)) {
		return false;
	}

	return true;

}

/*
 * Prepare a list of profile changes and update the user record in memory at the same time.
 */
function prepareProfileChanges (recUser, changes, newProfile, whitelistProfileFields) {

	Object.entries(newProfile).forEach(([ key, value ]) => {
		if (!value || (whitelistProfileFields && !whitelistProfileFields.includes(key))) { return; }
		changes[`profile.${key}`] = value;
		recUser.profile[key] = value;
	});

	changes[`profile.lastUpdated`] = Date.now();

}

/**
 * @typedef {Object} RefreshProfileOptions
 * @property {string} refreshEvery - minimum time period to refresh a profile (eg. "30 minutes")
 * @property {string} whitelistProfileFields - list of field names to refresh
 */

/**
 * Functions for refreshing profiles for a single user or all users
 *
 * @param {Object} recUser - record of user
 * @param {AdapterBase} adapter - adapter to fetch profile with
 * @param {DatabaseBase} database - database wrapper
 * @param {Function} triggerEvent - function to trigger an event
 * @param {RefreshProfileOptions} options - how often and which fields to refresh
 * @returns {undefined}
 */
async function refreshUserProfile (recUser, adapter, database, triggerEvent, options) {

	const refreshEvery = options.refreshEvery;
	const whitelistProfileFields = options.whitelistProfileFields || null;

	// Before we do anything else make sure we are allowed to refresh the user's profile.
	if (!isAllowedToRefresh(recUser, refreshEvery)) {
		return;
	}

	// Get the user's profile.
	recUser.profile = recUser.profile || {};

	const oldProfile = Object.assign({}, recUser.profile);
	const newProfile = await adapter.getUserProfile(recUser.channel.userId);
	const changes = {};

	if (!newProfile) {
		return;
	}

	// Make changes to the user's profile.
	prepareProfileChanges(recUser, changes, newProfile, whitelistProfileFields);
	await database.update(`User`, recUser, changes);

	// Trigger event listeners.
	await triggerEvent(`refreshed-user-profile`, { recUser, oldProfile });

}

/**
 * Refresh user profiles for all users.
 * Currently the implementation just calls refreshUserProfile for every user, could be optimised.
 *
 * @param {AdapterBase} adapter - adapter to fetch profile with
 * @param {DatabaseBase} database - database wrapper
 * @param {LoggerBase} sharedLogger - logger
 * @param {Function} triggerEvent - function to trigger an event
 * @param {RefreshProfileOptions} options - how often and which fields to refresh
 * @returns {Promise<void>} nothing
 */
async function refreshAllProfiles (adapter, database, sharedLogger, triggerEvent, options) {

	const recUsers = await database.find(`User`, {}, {});

	for (const recUser of recUsers) {

		try {
			await refreshUserProfile(recUser, adapter, database, triggerEvent, options); // eslint-disable-line no-await-in-loop
		}
		catch (err) {
			sharedLogger.error(`Failed to refresh user profile "${recUser._id}" because of "${err}".`);
		}

	}

}

/*
 * Export.
 */
module.exports = {
	refreshUserProfile,
	refreshAllProfiles,
};
