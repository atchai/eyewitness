'use strict';

/*
 * LOGGER
 * Makes the configured logger available to all other modules by taking advantage of Node's module caching.
 */

const loggers = [];

/*
 * Adds a new logger to the cache.
 */
module.exports.add = function addLogger (logger) {
	loggers.push(logger);
};

/*
 * Call the appropriate method on every logger in turn.
 */
const executeAllLoggers = async (method, ...args) => {

	const promises = loggers.map(
		logger => logger[method](...args).then(output => Object({ type: logger.getHandlerId(), output }))
	);

	// Execute all loggers at once.
	const results = await Promise.all(promises);
	const output = {};

	// Convert the array of results to a hash so we can access like "output.terminal".
	results.forEach(result => output[result.type] = result.output);
	return output;

};

module.exports.fatal = (...args) => executeAllLoggers(`fatal`, ...args);
module.exports.error = (...args) => executeAllLoggers(`error`, ...args);
module.exports.warn = (...args) => executeAllLoggers(`warn`, ...args);
module.exports.info = (...args) => executeAllLoggers(`info`, ...args);
module.exports.debug = (...args) => executeAllLoggers(`debug`, ...args);
module.exports.verbose = (...args) => executeAllLoggers(`verbose`, ...args);
module.exports.silly = (...args) => executeAllLoggers(`silly`, ...args);
