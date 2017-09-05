'use strict';

/*
 * SCHEMA: Article
 */

module.exports = function (Schema, Property) {

	return new Schema(`Article`, {
		feedId: new Property(`string`),
		storyId: new Property(`string`),
		storyUrl: new Property(`string`),
		imageUrl: new Property(`string`),
		title: new Property(`string`),
		description: new Property(`string`),
	});

};
