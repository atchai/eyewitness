'use strict';

/*
 * SCHEMA: Received
 */

module.exports = function (Schema, Property, Reference) {

	return new Schema(`Received`, {
		userId: new Reference(`User`),
		feedId: new Property(`string`),
		articleId: new Property(`string`),
		timestamp: new Property(`date`, Date.now),
	});

};
