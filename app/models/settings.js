'use strict';

/*
 * SCHEMA: Settings
 */

module.exports = function (Schema, Property/* , Reference */) {

	return new Schema(`Settings`, {
		botEnabled: new Property(`boolean`, true),
		welcomeMessages: [new Property(`string`)],
	});

};
