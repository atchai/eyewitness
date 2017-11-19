'use strict';

/*
 * SCHEMA: Welcome Message
 */

module.exports = function (Schema, Property/* , Reference */) {

	return new Schema(`WelcomeMessage`, {
		text: new Property(`string`),
		weight: new Property(`integer`),
	});

};
