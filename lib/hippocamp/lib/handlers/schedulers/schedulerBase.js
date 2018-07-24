'use strict';

/*
 * SCHEDULER BASE
 */

const HandlerBase = require(`../handlerBase`);

module.exports = class SchedulerBase extends HandlerBase {

	/*
	 * Initialises a new scheduler handler.
	 */
	constructor (type, handlerId) {
		super(type, handlerId);
	}

};
