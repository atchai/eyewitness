'use strict';

/*
 * SCHEMA: Welcome Message
 *
 * @deprecated - should no longer be required since we now have dynamic flow editing.
 */

module.exports = function (Schema, Property/* , Reference */) {

	return new Schema(`WelcomeMessage`, {
		text: new Property(`string`),
		weight: new Property(`integer`),
	});

};
