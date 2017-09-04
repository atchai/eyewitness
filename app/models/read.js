'use strict';

/*
 * SCHEMA: Read
 */

module.exports = function (Schema, Property, Reference) {

	return new Schema(`Read`, {
		userId: new Reference(`User`),
		feedId: new Property(`string`),
		storyId: new Property(`string`),
		timestamp: new Property(`date`, Date.now),
	});

};
