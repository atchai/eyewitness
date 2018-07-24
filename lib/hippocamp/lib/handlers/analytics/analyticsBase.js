'use strict';

/*
 * ANALYTICS BASE
 */

const HandlerBase = require(`../handlerBase`);

module.exports = class AnalyticsBase extends HandlerBase {

	/*
	 * Initialises a new analytics handler.
	 */
	constructor (type, handlerId) { // eslint-disable-line no-useless-constructor
		super(type, handlerId);
	}

	/*
	 * Logs out a message if an analytics handler hasn't overridden this method.
	 */
	trackUser (/* recUser, extraTraits */) {
		const sharedLogger = this.__dep(`sharedLogger`);
		sharedLogger.silly(`Analytics handler "${this.getHandlerId()}" does not support tracking users.`);
	}

	/*
	 * Logs out a message if an analytics handler hasn't overridden this method.
	 */
	trackEvent (/* recUser, eventName, eventData */) {
		const sharedLogger = this.__dep(`sharedLogger`);
		sharedLogger.silly(`Analytics handler "${this.getHandlerId()}" does not support tracking events.`);
	}

	/*
	 * Logs out a message if an analytics handler hasn't overridden this method.
	 */
	trackMessage (/* recUser, message */) {
		const sharedLogger = this.__dep(`sharedLogger`);
		sharedLogger.silly(`Analytics handler "${this.getHandlerId()}" does not support tracking messages.`);
	}

	/*
	 * Logs out a message if an analytics handler hasn't overridden this method.
	 */
	trackPageView (/* recUser, url, title */) {
		const sharedLogger = this.__dep(`sharedLogger`);
		sharedLogger.silly(`Analytics handler "${this.getHandlerId()}" does not support tracking page views.`);
	}

};
