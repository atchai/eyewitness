'use strict';

/*
 * SCHEMA: Article
 */

module.exports = function (Schema, Property, Reference) {

	return new Schema(`Article`, {
		feedId: new Property(`string`),
		articleId: new Property(`string`),
		articleUrl: new Property(`string`),
		articleDate: new Property(`date`),
		imageUrl: new Property(`string`),
		title: new Property(`string`),
		description: new Property(`string`),
		isPriority: new Property(`boolean`),
		isPublished: new Property(`boolean`, true),
		_receivedByUsers: [ new Reference(`User`) ],
		_readByUsers: [ new Reference(`User`) ],
		ingestedDate: new Property(`date`, Date.now),
	}, {
		indices: [
			{ isPriority: 1, articleDate: -1, isPublished: 1, _receivedByUsers: 1 },
		],
	});

};
