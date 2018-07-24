'use strict';

/*
 * Track a user using the analytics provider.
 */
module.exports = async function __executeActionTrackUser (action, recUser) {

	if (!recUser) {
		throw new Error(`Cannot execute action "track user" unless a user is provided.`);
	}

	const sharedLogger = this.__dep(`sharedLogger`);

	// Is user tracking allowed?
	if (!this.options.enableUserTracking) {
		sharedLogger.debug(`Skipping tracking user because "enableUserTracking" is disabled.`);
		return;
	}

	const analytics = this.__dep(`analytics`);

	if (!Object.keys(analytics).length) {
		throw new Error(`Cannot track users because an analytics handler has not been configured.`);
	}

	const trackPromises = Object.values(analytics).map(
		handler => handler.trackUser(recUser, action.traits)
	);

	await Promise.all(trackPromises);

};
