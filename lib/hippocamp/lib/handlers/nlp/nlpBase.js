'use strict';

/*
 * NLP BASE
 */

const HandlerBase = require(`../handlerBase`);

module.exports = class NlpBase extends HandlerBase {

	/*
	 * Initialises a new NLP handler.
	 */
	constructor (type, handlerId) { // eslint-disable-line no-useless-constructor
		super(type, handlerId);

		this.ROUNDING_NUM_DECIMALS = 6;
	}

	/*
	 * Logs out a message if an NLP handler hasn't overridden this method.
	 */
	async parseMessage (/* messageText */) {
		const sharedLogger = this.__dep(`sharedLogger`);
		sharedLogger.silly(`NLP handler "${this.getHandlerId()}" has not implemented message parsing.`);
	}

	/*
	 * Ensures the intent name is a JavaScript key-friendly value.
	 */
	formatObjectName (input) {
		return input.toUpperCase().replace(/[^a-z0-9_]/ig, `_`).replace(/^(\d)/i, `_$1`);
	}

	/*
	 * Rounds scores to a sensible number of decimal places.
	 */
	roundScore (input) {

		const number = parseFloat(input);
		const multiplier = Math.pow(10, this.ROUNDING_NUM_DECIMALS);

		return Math.round(number * multiplier) / multiplier;

	}

};
