'use strict';

/*
 * LOGGER: Terminal
 */

const clc = require(`cli-color`);
const jsome = require(`jsome`);
const moment = require(`moment`);
const extender = require(`object-extender`);
const LoggerBase = require(`./loggerBase`);

module.exports = class LoggerTerminal extends LoggerBase {

	/*
	 * Instantiates the handler.
	 */
	constructor (_options) {

		// Configure the handler.
		super(`logger`, `terminal`);

		// Default config for this handler.
		this.options = extender.defaults({
			logLevel: `verbose`,
			pretty: true,
			colours: true,
			isDisabled: false,
		}, _options);

		this.isDisabled = this.options.isDisabled;

		// Pretty colours for each log level.
		this.colourDictionary = {
			fatal: clc.redBright,
			error: clc.red,
			warn: clc.xterm(208),
			info: clc.green,
			debug: clc.xterm(20),
			verbose: clc.cyan,
			silly: clc.magenta,
		};

		// Setup for jsome module.
		if (!this.options.colours) { jsome.params.colored = false; }

	}

	/*
	 * Writes the log data to the standard log channel.
	 */
	__writeLog (level, data) {
		if (this.checkIfDisabled()) { return; }
		return this.__write(process.stdout, level, data);
	}

	/*
	 * Writes the log data to the error log channel.
	 */
	__writeErr (level, data) {
		if (this.checkIfDisabled()) { return; }
		return this.__write(process.stderr, level, data);
	}

	/*
	 * Writes the log data to the given stream. Returns a promise so that we can wait for logs to be written before
	 * continuing with execution if we need to.
	 */
	__write (stream, level, data) {

		if (this.checkIfDisabled()) { return; }

		return new Promise(resolve => {

			const preparedData = this.__prepareLogData(level, data);
			let output = ``;

			// The pretty option makes the terminal output easier to read for a human.
			if (this.options.pretty) {

				const timestamp = moment(preparedData.timestamp).format(`DD/MM/YYYY @ HH:mm:ss Z`);

				output += `\n`;

				if (this.options.colours) {
					const levelFormatted = this.colourDictionary[level].bold(`[${level}]`);
					output += this.colourDictionary[level](`${levelFormatted} ${timestamp}\n`);
				}
				else {
					output += `${level} ${timestamp}\n`;
				}

				if (preparedData.text) { output += `${preparedData.text}\n`; }

				if (preparedData.error) {
					const prettyStack = preparedData.error.stack.slice(1).join(`\n\t`);
					preparedData.error.stack = `\n\t${prettyStack}`;

					const errJson = jsome.getColoredString(preparedData.error);
					output += `Error: ${errJson}\n`;
				}

				if (preparedData.data && Object.keys(preparedData.data).length) {
					const dataJson = jsome.getColoredString(preparedData.data);
					output += `Data: ${dataJson}\n`;
				}

			}

			// Turning off the pretty option makes the output easier for a logging module to injest the data.
			else {
				const json = JSON.stringify(preparedData);
				output = `${json}\n`;
			}

			process.stdout.write(output, () => resolve(preparedData));

		});

	}

};
