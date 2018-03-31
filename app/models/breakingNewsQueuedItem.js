'use strict';

/*
 * SCHEMA: Breaking News Queue
 */

module.exports = function (Schema, Property) {

	return new Schema(`BreakingNewsQueuedItem`, {
		userData: new Property(`flexible`),
		articleData: new Property(`flexible`),
		addedDate: new Property(`date`, Date.now),
	});

};
