'use strict';

/*
 * WORKFLOW: TRACKING
 * Functions for tracking users, messages, events, etc.
 */

/*
 * Allows a user to be tracked via the enabled analytics handler.
 */
async function trackUser (recUser, extraTraits = {}) {

	const sharedLogger = this.__dep(`sharedLogger`);

	// Is user tracking allowed?
	if (!this.options.enableUserTracking) {
		sharedLogger.debug(`Skipping tracking user because "enableUserTracking" is disabled.`);
		return false;
	}

	const analytics = this.__dep(`analytics`);

	if (!Object.keys(analytics).length) {
		throw new Error(`Cannot track users because an analytics handler has not been configured.`);
	}

	const trackPromises = Object.values(analytics).map(
		handler => handler.trackUser(recUser, extraTraits)
	);

	await Promise.all(trackPromises);
	return true;

}

/*
 * Allows an event to be tracked via the enabled analytics handler.
 */
async function trackEvent (recUser, eventName, eventData) {

	const sharedLogger = this.__dep(`sharedLogger`);

	// Is event tracking allowed?
	if (!this.options.enableEventTracking) {
		sharedLogger.debug(`Skipping tracking event because "enableEventTracking" is disabled.`);
		return false;
	}

	const analytics = this.__dep(`analytics`);

	if (!Object.keys(analytics).length) {
		throw new Error(`Cannot track events because an analytics handler has not been configured.`);
	}

	const trackPromises = Object.values(analytics).map(
		handler => handler.trackEvent(recUser, eventName, eventData)
	);

	await Promise.all(trackPromises);
	return true;

}

/*
 * Allows a message to be tracked via the enabled analytics handler.
 */
async function trackMessage (recUser, message) {

	const sharedLogger = this.__dep(`sharedLogger`);

	// Is message tracking allowed?
	if (!this.options.enableMessageTracking) {
		sharedLogger.debug(`Skipping tracking user because "enableMessageTracking" is disabled.`);
		return false;
	}

	const analytics = this.__dep(`analytics`);

	if (!Object.keys(analytics).length) {
		throw new Error(`Cannot track messages because an analytics handler has not been configured.`);
	}

	const trackPromises = Object.values(analytics).map(
		handler => handler.trackMessage(recUser, message)
	);

	await Promise.all(trackPromises);
	return true;

}

/*
 * Export.
 */
module.exports = {
	trackUser,
	trackEvent,
	trackMessage,
};
