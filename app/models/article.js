'use strict';

/*
 * SCHEMA: Article
 */

module.exports = function (Schema, Property, Reference) {

	return new Schema(`Article`, {
		feedId: new Property(`string`),
		articleId: new Property(`string`),
		articleUrl: new Property(`string`),
		imageUrl: new Property(`string`),
		title: new Property(`string`),
		description: new Property(`string`),
		_receivedByUsers: [new Reference(`User`)],
		_readByUsers: [new Reference(`User`)],
	});

};
