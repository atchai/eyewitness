'use strict';

/*
 * SCHEMA
 */

module.exports = class Schema {

	constructor (_modelName, _fields, _options) {

		this.modelName = _modelName;
		this.fields = _fields;
		this.options = _options || {};

	}

};
