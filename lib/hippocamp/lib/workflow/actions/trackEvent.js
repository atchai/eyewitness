'use strict';

/*
 * Track an action using the analytics provider.
 */
module.exports = async function __executeActionTrackEvent (action, recUser) {

	if (!recUser) {
		throw new Error(`Cannot execute action "track event" unless a user is provided.`);
	}

	const sharedLogger = this.__dep(`sharedLogger`);

	// Is event tracking allowed?
	if (!this.options.enableEventTracking) {
		sharedLogger.debug(`Skipping tracking event because "enableEventTracking" is disabled.`);
		return;
	}

	const analytics = this.__dep(`analytics`);

	if (!Object.keys(analytics).length) {
		throw new Error(`Cannot track events because an analytics handler has not been configured.`);
	}

	const trackPromises = Object.values(analytics).map(
		handler => handler.trackEvent(recUser, action.event.name, action.event.data)
	);

	await Promise.all(trackPromises);

};
