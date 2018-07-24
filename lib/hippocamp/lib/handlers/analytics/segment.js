'use strict';

/*
 * ANALYTICS: Segment
 */

const Analytics = require(`analytics-node`); // Segment.
const moment = require(`moment`);
const extender = require(`object-extender`);
const AnalyticsBase = require(`./analyticsBase`);

module.exports = class AnalyticsSegment extends AnalyticsBase {

	/*
	 * Instantiates the handler.
	 */
	constructor (_options) {

		// Configure the handler.
		super(`analytics`, `segment`);

		// Default config for this handler.
		this.options = extender.defaults({
			writeKey: null,
			isDisabled: false,
		}, _options);

		this.isDisabled = this.options.isDisabled;

		// Instantiate Segment.
		this.analytics = new Analytics(this.options.writeKey);

	}

	/*
	 * Push the user data into Segment.
	 */
	trackUser (recUser, extraTraits = null) {

		if (this.checkIfDisabled()) { return; }

		const appData = recUser.appData || {};
		const profile = recUser.profile || {};
		const firstName = appData.firstName || profile.firstName || ``;
		const lastName = appData.lastName || profile.lastName || ``;
		const dateCreated = appData.created || profile.created || null;
		const dateLastUpdated = appData.lastUpdated || profile.lastUpdated || null;

		const defaultTraits = {
			firstName: firstName || void (0),
			lastName: lastName || void (0),
			name: `${firstName} ${lastName}`.trim() || recUser._id.toString(),
			gender: appData.gender || profile.gender || void (0),
			email: appData.email || profile.email || void (0),
			phone: appData.tel || profile.tel || void (0),
			age: appData.age || profile.age || void (0),
		};

		const readOnlyTraits = {
			created: (dateCreated ? moment(dateCreated).toISOString() : void (0)),
			lastUpdated: (dateLastUpdated ? moment(dateLastUpdated).toISOString() : void (0)),
		};

		const traits = extender.defaults(defaultTraits, extraTraits, readOnlyTraits);

		// Make the request.
		this.analytics.identify({
			userId: recUser._id.toString(),
			traits,
		});

	}

	/*
	 * Push the event data into Segment.
	 */
	trackEvent (recUser, eventName, eventData) {

		if (this.checkIfDisabled()) { return; }

		this.analytics.track({
			userId: recUser._id.toString(),
			event: eventName,
			properties: eventData || {},
		});

	}

	/*
	 * Push the page view data into Segment.
	 */
	trackPageView (recUser, url, title = ``, _properties = {}) {

		if (this.checkIfDisabled()) { return; }

		const userId = recUser._id.toString();

		this.analytics.page({
			userId,
			name: title,
			title,
			url,
			properties: {
				..._properties,
				userId,
				name: title,
				title,
				url,
			},
		});

	}

};
