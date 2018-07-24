'use strict';

/*
 * WORKFLOW: VARIABLES
 * Functions for dealing with variables in templated strings.
 */

const deepProperty = require(`deep-property`);
const escapeRegExp = require(`escape-regexp`);
const extender = require(`object-extender`);
const safeEval = require(`safe-eval`);

/*
 * Match against a referenced variable in the input, if any.
 */
function __matchReferencedVariableName (input, preserveContext) {

	const refPattern = `<([a-z0-9_\\-.]+)>`;
	const refRegExp = new RegExp(preserveContext ? refPattern : `^${refPattern}$`, `i`);
	const [ , refVariableName ] = input.match(refRegExp) || [];

	return refVariableName || null;

}

/*
 * Evaluates referenced variables in a string and returns the output, and optional context.
 */
function evaluateReferencedVariables (input, variables, preserveContext = false) {

	let output = null;
	let context = {};

	// If the input is not a string then there is no chance it contains referenced variable names.
	if (typeof input !== `string`) { return null; }

	// If a wildcard is present we return all the user input variables as-is.
	if (input === `*`) { return { output: variables.__userInput, context }; }

	// First check if we can match against a referenced variable in the input.
	const refVariableName = this.__matchReferencedVariableName(input, preserveContext);
	if (!refVariableName) { return null; }

	// Pull out the value of the referenced variable.
	const value = deepProperty.get(variables, refVariableName);

	// If preserving the context, substitute the variable name into the string and add the value to the context object.
	if (preserveContext) {
		const replaceRegExp = new RegExp(`<${escapeRegExp(refVariableName)}>`, `m`);
		output = input.replace(replaceRegExp, refVariableName);
		deepProperty.set(context, refVariableName, value);
	}

	// If not preserving the context, just return the value straight out.
	else {
		output = (typeof value === `undefined` ? null : value);
	}

	// Check there are no more referenced variables that need replacing.
	const result = this.evaluateReferencedVariables(output, variables, preserveContext);

	if (result) {
		output = result.output;
		context = extender.merge(context, result.context);
	}

	return { output, context };

}

/*
 * Returns true if there is no conditional, or the conditional evaluates to a truthy value.
 */
function evaluateConditional (conditional, variables) {

	if (!conditional) { return true; }

	// Prepare the conditional by substituting variables.
	const evalResult = this.evaluateReferencedVariables(conditional, variables, true);
	if (!evalResult) { return false; }

	// Evaluate the conditional.
	let conditionalResult;

	try {
		conditionalResult = safeEval(evalResult.output, evalResult.context, {
			filename: `pseudo`,
			displayErrors: true,
		});
	}
	catch (err) {
		throw new Error(`Failed to evaluate action conditional because of "${err}".`);
	}

	return Boolean(conditionalResult);

}

/*
 * Export.
 */
module.exports = {
	__matchReferencedVariableName,
	evaluateReferencedVariables,
	evaluateConditional,
};
