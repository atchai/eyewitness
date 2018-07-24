'use strict';

/*
 * LOGGER: Filesystem
 */

const filesystem = require(`fs`);
const path = require(`path`);
const moment = require(`moment`);
const extender = require(`object-extender`);
const LoggerBase = require(`./loggerBase`);

module.exports = class LoggerFilesystem extends LoggerBase {

	/*
	 * Instantiates the handler.
	 */
	constructor (_options) {

		// Configure the handler.
		super(`logger`, `filesystem`);

		// Default config for this handler.
		this.options = extender.defaults({
			logLevel: `verbose`,
			directory: null,
			rotation: `daily`,
			isDisabled: false,
		}, _options);

		this.isDisabled = this.options.isDisabled;

		// Ensure a directory path has been specified and that it is an absolute path.
		if (!this.options.directory) {
			throw new Error(`You must specify the "directory" option when instantiating the filesystem logger.`);
		}
		else if (!path.isAbsolute(this.options.directory)) {
			this.options.directory = path.join(process.cwd(), this.options.directory);
		}

		// The cache for the log file streams.
		this.logFileStreams = {
			standard: { filename: null, stream: null },
			error: { filename: null, stream: null },
		};

	}

	/*
	 * Writes the log data to the standard log channel.
	 */
	__writeLog (level, data) {
		if (this.checkIfDisabled()) { return; }
		return this.__write(`standard`, level, data);
	}

	/*
	 * Writes the log data to the error log channel.
	 */
	__writeErr (level, data) {
		if (this.checkIfDisabled()) { return; }
		return this.__write(`error`, level, data);
	}

	/*
	 * Writes the log data to the given stream.
	 */
	__write (type, level, data) {

		if (this.checkIfDisabled()) { return; }

		return new Promise(resolve => {

			const stream = this.__getFileStream(type);
			const preparedData = this.__prepareLogData(level, data);
			const json = JSON.stringify(preparedData);
			const output = `${json}\n`;

			stream.write(output, () => resolve(preparedData));

		});

	}

	/*
	 * Returns the correct log file stream for the given type, taking into account log file rotation if it's configured.
	 */
	__getFileStream (type) {

		const logFilename = this.__getLogFilename(type);

		// If the filename is different we need to rotate the log file.
		if (this.logFileStreams[type].filename !== logFilename) {

			// Kill the old stream if one exists.
			if (this.logFileStreams[type].stream) { this.logFileStreams[type].stream.end(); }

			// Open a new write stream.
			this.logFileStreams[type].filename = logFilename;
			this.logFileStreams[type].stream = filesystem.createWriteStream(logFilename, { flags: `a` });

		}

		return this.logFileStreams[type].stream;

	}

	/*
	 * Returns the filename of the given type of log file, taking into account log rotation.
	 */
	__getLogFilename (type) {

		let dateType = this.options.rotation;
		let dateFormatted;

		switch (this.options.rotation) {

			case `monthly`:
				dateFormatted = moment.utc().format(`YYYY-MM`);
				break;

			case `weekly`:
				dateFormatted = moment.utc().format(`YYYY-MM_WW`);
				break;

			case `daily`:
				dateFormatted = moment.utc().format(`YYYY-MM-DD`);
				break;

			case `hourly`:
				dateFormatted = moment.utc().format(`YYYY-MM-DD_HH`);
				break;

			default:  // Do not rotate.
				dateFormatted = null;
				dateType = `norotate`;
				break;

		}

		// Construct the absolute filename.
		const filename = `${type}_${dateType}${dateFormatted ? `_${dateFormatted}` : ``}.log`;
		return path.join(this.options.directory, filename);

	}

};
