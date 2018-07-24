'use strict';

/*
 * CUSTOM INPUT HANDLER BASE.
 *
 * A handler to detect input and take some action. Designed to be extended by specific apps.
 *
 * Any sub-class must override handleInput(message)
 */

const HandlerBase = require(`../handlerBase`);

module.exports = class CustomInputHandlerBase extends HandlerBase {

	/*
	 * Initialises a new custom input handler.
	 */
	constructor (handlerId) {
		super(`custom`, handlerId);

	}

	/**
	 * Sub-class must override this. Runs once when the periodic handler is configured.
	 * returns true if the input has been handled and should stop further processing
	 */
	async handleInput (message, recUser) { // eslint-disable-line no-unused-vars
		throw new Error(`handleInput(...) must be overridden.`);
	}

};
