'use strict';

/*
 * SCHEMA: GlobalSettings
 */

module.exports = function (Schema, Property, Reference) {

	return new Schema(`GlobalSettings`, {
		_defaultFlow: new Reference(`Flow`),
		_stopFlow: new Reference(`Flow`),
		_helpFlow: new Reference(`Flow`),
		_feedbackFlow: new Reference(`Flow`),
	});

};
