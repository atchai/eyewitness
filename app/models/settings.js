'use strict';

/*
 * SCHEMA: Settings
 */

module.exports = function (Schema, Property/* , Reference */) {

	return new Schema(`Settings`, {
		isBotEnabled: new Property(`boolean`, true),
	});

};
