'use strict';

/*
 * DATABASE BASE
 */

const HandlerBase = require(`../handlerBase`);

module.exports = class DatabaseBase extends HandlerBase {

	/*
	 * Initialises a new database handler.
	 */
	constructor (type, handlerId) {

		// Configure the handler.
		super(type, handlerId);

		this.models = {};

	}

	/*
	 * Returns true if the given model name already exists.
	 */
	hasModel (modelName) {
		return Boolean(this.models[modelName]);
	}

	/*
	 * Returns the given model or throws an error if it doesn't exit.
	 * The main reason to get a model is to use static convenience methods such as getAll() or getById(id).
	 */
	getModel (modelName) {

		const Model = this.models[modelName];

		if (!Model) {
			throw new Error(`Model "${modelName}" has not been added to the "${this.getHandlerId()}" database handler.`);
		}

		return Model;

	}

	get (modelName, conditions, options = {}) {
		const sharedLogger = this.__dep(`sharedLogger`);
		sharedLogger.silly({
			text: `Running "get" query via "${this.getHandlerId()}" database handler.`,
			modelName,
			conditions,
			options,
		});
	}

	find (modelName, conditions, options = {}) {
		const sharedLogger = this.__dep(`sharedLogger`);
		sharedLogger.silly({
			text: `Running "find" query via "${this.getHandlerId()}" database handler.`,
			modelName,
			conditions,
			options,
		});
	}

	insert (modelName, properties) {
		const sharedLogger = this.__dep(`sharedLogger`);
		sharedLogger.silly({
			text: `Running "insert" query via "${this.getHandlerId()}" database handler.`,
			modelName,
			properties,
		});
	}

	update (modelName, input, changes, options) {
		const sharedLogger = this.__dep(`sharedLogger`);
		sharedLogger.silly({
			text: `Running "update" query via "${this.getHandlerId()}" database handler.`,
			modelName,
			input,
			changes,
			options,
		});
	}

	delete (modelName, input) {
		const sharedLogger = this.__dep(`sharedLogger`);
		sharedLogger.silly({
			text: `Running "delete" query via "${this.getHandlerId()}" database handler.`,
			modelName,
			input,
		});
	}

	deleteWhere (modelName, conditions) {
		const sharedLogger = this.__dep(`sharedLogger`);
		sharedLogger.silly({
			text: `Running "deleteWhere" query via "${this.getHandlerId()}" database handler.`,
			modelName,
			conditions,
		});
	}

	/*
	 * Creates an error base on an error ID and a set of values to transpose into a predefined message.
	 */
	__error (errorId, values) {
		/* eslint max-len: 0 */

		let message;

		switch (errorId) {
			case `EXISTING_MODEL`: message = `You have already added the "${values.modelName}" model.`; break;
			case `MOCK_FAILED`: message = `Failed to mock the database because of "${values.err}".`; break;
			case `CONNECT_FAILED`: message = `Failed to connect to the database because of "${values.err}".`; break;
			case `UPDATE_MISSING_DOCUMENT`: message = `Cannot update ${values.modelName} document "${values.documentID}" because it doesn't already exist in the database.`; break;
			default: throw new Error(`Invalid error ID.`);
		}

		return super.__error(errorId, message);

	}

};
