'use strict';

/*
 * SCHEMA: User
 */

module.exports = function (Schema, Property) {

	return new Schema(`User`, {
		profile: {
			firstName: new Property(`string`, ``),
			lastName: new Property(`string`, ``),
			gender: new Property(`string`, ``),
			email: new Property(`string`, ``),
			tel: new Property(`string`, ``),
			age: new Property(`integer`, null),
			profilePicUrl: new Property(`string`, ``),
			timezoneUtcOffset: new Property(`integer`, 0),
			referral: new Property(`string`, null),
			created: new Property(`date`, Date.now),
			lastUpdated: new Property(`date`, 0),
		},
		channel: {
			name: new Property(`string`),
			userId: new Property(`string`),
		},
		conversation: {
			previousStepUri: new Property(`string`, null),
			currentStepUri: new Property(`string`, null),
			waitingOnPrompt: new Property(`boolean`, false),
			lastMessageReceivedAt: new Property(`date`, Date.now),
			lastMessageSentAt: new Property(`date`, 0),
		},
		bot: {
			disabled: new Property(`boolean`, false),
			removed: new Property(`boolean`, false),
		},
		appData: new Property(`flexible`),
	});

};
