'use strict';

/*
 * MIDDLEWARE: Populate Message Variables
 */

const extender = require(`object-extender`);
const utilities = require(`../modules/utilities`);

module.exports = function populateMessageVariablesMiddleware (database, sharedLogger, hippocampOptions) {

	// The actual middleware.
	return async (message, adapter, recUser, next/* , stop */) => {

		sharedLogger.debug({
			text: `Running middleware "populateMessageVariablesMiddleware".`,
			direction: message.direction,
			message: message.text,
			userId: recUser._id.toString(),
			channelName: recUser.channel.name,
			channelUserId: recUser.channel.userId,
		});

		// Prepare variables.
		const variables = extender.merge(
			hippocampOptions.messageVariables,
			recUser.profile,
			recUser.appData
		);

		// Compile the various templates.
		if (message.text) { message.text = utilities.compileTemplate(message.text, variables); }

		if (message.options) {
			message.options = message.options.map(option => {
				option.label = utilities.compileTemplate(option.label, variables);
				option.payload = utilities.compileTemplate(option.payload, variables);
				return option;
			});
		}

		if (message.buttons) {
			message.buttons = message.buttons.map(button => {
				button.label = utilities.compileTemplate(button.label, variables);
				button.payload = utilities.compileTemplate(button.payload, variables);
				return button;
			});
		}

		return next(null, recUser);

	};

};
