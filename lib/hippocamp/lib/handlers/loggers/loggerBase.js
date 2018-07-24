'use strict';

/*
 * LOGGER BASE
 */

const moment = require(`moment`);
const extender = require(`object-extender`);
const HandlerBase = require(`../handlerBase`);

module.exports = class LoggerBase extends HandlerBase {

	/*
	 * Returns the integer that corresponds to the log level string.
	 */
	__getLogLevelInteger (logLevelString) {

		switch (logLevelString) {
			case `fatal`: return 0;
			case `error`: return 1;
			case `warn`: return 2;
			case `info`: return 3;
			case `debug`: return 4;
			case `verbose`: return 5;
			case `silly`: return 6;
			default: throw new Error(`Invalid log level string.`);
		}

	}

	/*
	 * Returns true if we are allowed to log at the configred log level.
	 */
	__isLoggableAt (logLevelString) {
		const checkLogLevel = this.__getLogLevelInteger(logLevelString);
		const configuredLogLevel = this.__getLogLevelInteger(this.options.logLevel);
		return Boolean(checkLogLevel <= configuredLogLevel);
	}

	/*
	 * Ensure all log data is in the same format.
	 */
	__prepareLogData (level, data) {

		const logData = {
			text: null,
			data: {},
			error: null,
		};

		if (data instanceof Error) {
			logData.error = {
				name: data.name,
				code: data.code || data.errorId || null,
				message: data.message,
				extraData: data.extraData || null,
				stack: data.stack.split(/\n/g),
			};
		}
		else if (typeof data === `string`) {
			logData.text = data;
		}
		else if (typeof data === `object`) {
			if (data.text) {
				logData.text = data.text;
				delete data.text;
			}
			logData.data = new Object(data);
		}
		else {
			throw new Error(`The log data is an invalid type.`);
		}

		// Remove stuff that clogs up the logs.
		if (!logData.text) { delete logData.text; }
		if (!logData.data || !Object.keys(logData.data).length) { delete logData.data; }
		if (!logData.error) { delete logData.error; }

		return extender.merge(logData, {
			level,
			timestamp: moment.utc().toISOString(),
		});

	}

	fatal (...args) {
		if (!this.__isLoggableAt(`fatal`)) { return Promise.resolve(); }
		return this.__writeErr(`fatal`, ...args);
	}

	error (...args) {
		if (!this.__isLoggableAt(`error`)) { return Promise.resolve(); }
		return this.__writeErr(`error`, ...args);
	}

	warn (...args) {
		if (!this.__isLoggableAt(`warn`)) { return Promise.resolve(); }
		return this.__writeErr(`warn`, ...args);
	}

	info (...args) {
		if (!this.__isLoggableAt(`info`)) { return Promise.resolve(); }
		return this.__writeLog(`info`, ...args);
	}

	debug (...args) {
		if (!this.__isLoggableAt(`debug`)) { return Promise.resolve(); }
		return this.__writeLog(`debug`, ...args);
	}

	verbose (...args) {
		if (!this.__isLoggableAt(`verbose`)) { return Promise.resolve(); }
		return this.__writeLog(`verbose`, ...args);
	}

	silly (...args) {
		if (!this.__isLoggableAt(`silly`)) { return Promise.resolve(); }
		return this.__writeLog(`silly`, ...args);
	}

};
