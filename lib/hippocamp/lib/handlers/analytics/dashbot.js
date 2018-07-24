'use strict';

/*
 * ANALYTICS: Dashbot
 */

const dashbot = require(`dashbot`);
const extender = require(`object-extender`);
const AnalyticsBase = require(`./analyticsBase`);

module.exports = class AnalyticsDashbot extends AnalyticsBase {

	/*
	 * Instantiates the handler.
	 */
	constructor (_options) {

		// Configure the handler.
		super(`analytics`, `dashbot`);

		// Default config for this handler.
		this.options = extender.defaults({
			apiKey: null,
			obfuscateMessages: false,
			isDisabled: false,
		}, _options);

		this.isDisabled = this.options.isDisabled;

		// Instantiate Dashbot.
		this.analytics = dashbot(this.options.apiKey).generic;

	}

	/*
	 * Push the given message into Dashbot.
	 */
	trackMessage (recUser, message) {

		if (this.checkIfDisabled()) { return; }

		const methodName = `log${message.direction[0].toUpperCase()}${message.direction.substr(1)}`;
		const logMessage = this.analytics[methodName];
		let text = message.text || `-not set-`;
		let platformJson = message;

		if (this.options.obfuscateMessages) {
			text = `-obfuscated-`;
			platformJson = { obfuscated: true };
		}

		logMessage({
			userId: recUser._id.toString(),
			text,
			platformJson,
		});

	}

};
