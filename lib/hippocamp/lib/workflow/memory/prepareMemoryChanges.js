'use strict';

const deepProperty = require(`deep-property`);
const extender = require(`object-extender`);
const utilities = require(`../../modules/utilities`);

/*
 * Adjusts an existing numeric value in memory by incrementing or decrementing it.
 */
function __handlePrepareValueAdjustment (memoryDefinition, operation, existingMemory, normalisedFieldName) {

	const existingValue = deepProperty.get(existingMemory, normalisedFieldName);
	const amount = memoryDefinition.amount || (operation === `increment` ? 1 : -1);
	const value = (typeof existingValue === `number` ? existingValue : 0) + amount;

	return value;

}

/*
 * Pulls a value from the given input using a regular expression.
 */
function __handlePrepareValueRegExp (input, memoryDefinition) {

	const regexp = new RegExp(memoryDefinition.regexp, `i`);
	const textMatches = input.text.match(regexp);
	const value = (textMatches && textMatches[1] ? textMatches[1] : void (0));

	return value;

}

/*
 * Pulls a value from a referenced variable.
 */
function __handlePrepareValueReference (input, memoryDefinition, variables) {

	const evalResult = this.evaluateReferencedVariables(memoryDefinition.reference, variables, false);
	const value = (evalResult ? evalResult.output : void (0));

	return value;

}

/*
 * Logs and throws an error when a required memory field is missing a valid value.
 */
function __handleMissingRequiredField (memoryDefinition, normalisedFieldName, value, defaultErrorMessage) {

	const sharedLogger = this.__dep(`sharedLogger`);

	const err = new Error(memoryDefinition.errorMessage || defaultErrorMessage || `An unexpected error occured.`);
	err.validationError = true;

	sharedLogger.error(`Memory validation error - "${normalisedFieldName}" is required but has a value of "${value}".`);
	throw err;

}

/*
 * Returns the given value transformed with the given transformation type.
 */
function __transformValue (oldValue, transformType) {

	let value;

	switch (transformType) {
		case `lowercase`: value = (typeof oldValue === `string` ? oldValue.toLowerCase() : oldValue); break;
		case `uppercase`: value = (typeof oldValue === `string` ? value = oldValue.toUpperCase() : oldValue); break;
		case `integer`: value = (typeof oldValue === `string` ? value = parseInt(oldValue) : oldValue); break;
		case `float`: value = (typeof oldValue === `string` ? value = parseFloat(oldValue) : oldValue); break;
		case `boolean`: value = utilities.parseBoolean(oldValue); break;
		case `time`: value = utilities.parseTime(oldValue); break;
		case `preserve`: value = oldValue; /* no changes to make */ break;
		default: throw new Error(`Invalid memory transform type of "${transformType}".`);
	}

	return value;

}

/*
 * Prepares a single set operation on a memory definition.
 */
function __handlePrepareSetOperation (input, memoryDefinition, operation, isASetOperation, options) {

	let value;

	// Only for operations that are setting values.
	if (!isASetOperation) { return value; }

	const { variables, transform, isRequired, existingMemory, normalisedFieldName, defaultErrorMessage } = options;

	// A numeric increment/decrement operation.
	if (operation === `increment` || operation === `decrement`) {
		value = this.__handlePrepareValueAdjustment(memoryDefinition, operation, existingMemory, normalisedFieldName);
	}

	// A standard set operation.
	else if (operation === `set` || operation === `push`) {

		// Are we setting a specific value?
		if (memoryDefinition.value) {
			value = memoryDefinition.value;
		}

		// Are we pulling a value out of the message text using a regexp?
		else if (memoryDefinition.regexp && input) {
			value = this.__handlePrepareValueRegExp(input, memoryDefinition);
		}

		// Are we referencing a variable in the input (i.e. from a webview form submission)?
		else if (memoryDefinition.reference && variables) {
			value = this.__handlePrepareValueReference(input, memoryDefinition, variables);
		}

	}

	// Whoops! We can't continue if a required field is missing!
	if (!value && isRequired) {
		this.__handleMissingRequiredField(memoryDefinition, normalisedFieldName, value, defaultErrorMessage);
	}

	// Do we need to transform the value?
	if (transform) {
		value = this.__transformValue(value, transform);
	}

	return value;

}

/*
 * Adds a single memory change to the given set.
 */
function __addToMemoryChangeSet ( // eslint-disable-line max-params
	setValues, unsetValues, existingMemory, normalisedFieldName, operation, isASetOperation, value
) {

	if (typeof value !== `undefined` && isASetOperation) {
		if (operation === `push`) {
			const existingArray = existingMemory[normalisedFieldName] || [];
			setValues[`appData.${normalisedFieldName}`] = [ ...existingArray, value ];
		}
		else {
			setValues[`appData.${normalisedFieldName}`] = value;
		}
	}
	else {
		unsetValues[`appData.${normalisedFieldName}`] = true;
	}

}

/*
 * Returns a dictionary of memory changes to apply to the user record.
 */
function prepareMemoryChanges (
	input,
	memoryDefinitions,
	_existingMemory,
	defaultErrorMessage,
	_variables
) {

	const existingMemory = extender.clone(_existingMemory);
	const variables = extender.merge(_variables, input, { __userInput: input });
	const allowedSetOperations = [ `set`, `push`, `increment`, `decrement` ];
	const setValues = {};
	const unsetValues = {};

	// Save each memory field in turn.
	for (const fieldName in memoryDefinitions) {
		if (!memoryDefinitions.hasOwnProperty(fieldName)) { continue; }

		const memoryDefinition = memoryDefinitions[fieldName];

		// memoryDefinitions object may be from BSON in which cannot contain '.' in field name
		// so we allow '/' instead. So we need to normalise to use '.'
		const normalisedFieldName = fieldName.replace(/\//g, `.`);

		const operation = (memoryDefinition.operation || `set`).toLowerCase();
		const transform = (memoryDefinition.transform || `lowercase`).toLowerCase();
		const isRequired = (typeof memoryDefinition.required === `undefined` ? true : memoryDefinition.required);
		const isASetOperation = allowedSetOperations.includes(operation);

		const value = this.__handlePrepareSetOperation(input, memoryDefinition, operation, isASetOperation, {
			variables,
			transform,
			isRequired,
			existingMemory,
			normalisedFieldName,
			defaultErrorMessage,
		});

		// Save or unset the memory field.
		this.__addToMemoryChangeSet(
			setValues, unsetValues, existingMemory, normalisedFieldName, operation, isASetOperation, value
		);
	}

	return { set: setValues, unset: unsetValues };

}

/*
 * Export.
 */
module.exports = {
	__handlePrepareValueAdjustment,
	__handlePrepareValueRegExp,
	__handlePrepareValueReference,
	__handleMissingRequiredField,
	__transformValue,
	__handlePrepareSetOperation,
	__addToMemoryChangeSet,
	prepareMemoryChanges,
};
