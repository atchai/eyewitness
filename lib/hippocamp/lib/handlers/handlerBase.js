'use strict';

/*
 * HANDLER
 */

const MiddlewareEngine = require(`middleware-engine`);

module.exports = class HandlerBase extends MiddlewareEngine {

	/*
	 * Instantiates a new handler.
	 */
	constructor (_type, _handlerId, middlewareEngineConfig = null) {

		// Configure the middleware engine.
		super(middlewareEngineConfig);

		this.type = _type;
		this.handlerId = _handlerId;
		this.isDisabled = false;

	}

	/*
	 * Returns the type of the currently instantiated handler.
	 */
	getType () {
		return this.type;
	}

	/*
	 * Returns the type of the currently instantiated handler.
	 */
	getHandlerId () {
		return this.handlerId;
	}

	/*
	 * Logs out a message and returns true if the handler is disabled.
	 */
	checkIfDisabled () {

		if (!this.isDisabled) { return false; }

		const sharedLogger = this.__dep(`sharedLogger`);

		sharedLogger.silly(`The ${this.getType()} handler "${this.getHandlerId()}" is disabled.`);
		return true;

	}

	/*
	 * Creates an error with the given message and fixes the stack trace (otherwise the stack trace would start at this
 	 * method instead of the actual place the error gets thrown).
	 */
	__error (errorId, message) {

		const err = new Error(message);

		// Remove the first two lines from the stack trace.
		const stack = err.stack.split(/\n/g);
		stack.splice(1, 2);
		err.stack = stack.join(`\n`);

		// Add the error ID.
		err.errorId = errorId;

		return err;

	}

};
