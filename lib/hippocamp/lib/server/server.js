'use strict';

/*
 * SERVER
 */

const http = require(`http`);
const url = require(`url`);
const escapeRegExp = require(`escape-regexp`);
const MiddlewareEngine = require(`middleware-engine`);
const extender = require(`object-extender`);

module.exports = class Server extends MiddlewareEngine {

	/*
	 * Instantiates a new server.
	 */
	constructor (_options) {

		// Configure the middleware engine.
		super();

		// Default values for just the options we care about.
		this.options = extender.defaults({
			port: null,
		}, _options);

		this.server = http.createServer(this.handleIncomingRequest.bind(this));
		this.mountPoints = {};

	}

	/*
	 * Mounts the given request handler function using the given base path as the mount point. Any requests that match the
	 * base path will be passed over to the request handler.
	 */
	mount (_basePath, requestHandler) {

		const basePath = (_basePath[0] === `/` ? _basePath : `/${_basePath}`);
		const mountPoint = escapeRegExp(basePath);

		// Doesn't make sense to allow two request handlers to be mounted to the same base path.
		if (this.mountPoints[mountPoint]) {
			throw new Error(`A request handler is already mounted on "${basePath}".`);
		}

		this.mountPoints[mountPoint] = { basePath, requestHandler };

	}

	/*
	 * Start the server listing, if no port is provided we'll use the one provided to the constructor.
	 */
	listen (_port = null) {

		const sharedLogger = this.__dep(`sharedLogger`);
		const port = _port || this.options.port;

		sharedLogger.info(`Starting server...`);

		if (!port) { throw new Error(`You must specify a port for the server!`); }

		return new Promise((resolve, reject) => {
			this.server.listen(port, err => { // eslint-disable-line promise/prefer-await-to-callbacks
				if (err) { return reject(err); }
				sharedLogger.info(`Server ready!`);
				return resolve();
			});
		});

	}

	/*
	 * Processes each request as it comes in.
	 */
	handleIncomingRequest (req, res) {
		/* eslint promise/no-promise-in-callback: 0 */

		const sharedLogger = this.__dep(`sharedLogger`);
		const chunks = [];

		req.on(`error`, err => this.__onIncomingRequestError(err, req, res).catch(err => sharedLogger.error(err))); // eslint-disable-line promise/prefer-await-to-callbacks
		req.on(`data`, nextChunk => chunks.push(nextChunk));
		req.on(`end`, () => this.__onIncomingRequestSuccess(req, res, chunks).catch(err => sharedLogger.error(err))); // eslint-disable-line promise/prefer-await-to-callbacks

	}

	/*
	 * Respond to the consumer after processing the request.
	 */
	async __onIncomingRequestSuccess (req, res, chunks) {

		const sharedLogger = this.__dep(`sharedLogger`);
		const data = chunks.join(``);
		const contentType = req.headers[`content-type`] || null;
		let requestHandler;

		// Add handy methods to the response object.
		res.status = this.__status.bind(this, res);
		res.setHeaders = this.__setHeaders.bind(this, res);
		res.redirect = this.__redirect.bind(this, res);
		res.respond = this.__respond.bind(this, res);

		// Find a handler for this route.
		try {
			requestHandler = this.__findMountedRequestHandler(req.url);
		}
		catch (err) {
			sharedLogger.error(err);
			return res.status(404).respond(`This URL is not correct.`, false);
		}

		// Parse the incoming data.
		req.body = (contentType && contentType.match(/application\/json/i) ? JSON.parse(data) : data);
		req.query = url.parse(req.url, true).query;

		// Log the request as we can handle it.
		sharedLogger.verbose({
			text: `Incoming request`,
			incomingRequest: {
				method: req.method,
				url: req.url,
				contentType,
				body: req.body,
			},
		});

		return requestHandler(req, res);

	}

	/*
	 * Respond to the consumer if an error occurs whilst processing an incoming request.
	 */
	async __onIncomingRequestError (_err, req, res) {

		const sharedLogger = this.__dep(`sharedLogger`);
		const err = new Error(`Unable to handle the incoming request "${req.url}" because of "${_err}".`);
		let logMethod;

		if (_err instanceof Error) {
			logMethod = `error`;
			err.stack = _err.stack;
		}
		else {
			logMethod = `warn`;
		}

		const output = await sharedLogger[logMethod](err);

		// Don't allow the consumer to see the stack trace.
		delete output.terminal.error.stack;
		res.status(500).respond(output);

	}

	/*
	 * Returns the first matching request handler that is mounted to the given path.
	 */
	__findMountedRequestHandler (path) {

		for (const mountPoint in this.mountPoints) {
			if (!this.mountPoints.hasOwnProperty(mountPoint)) { continue; }

			const mounted = this.mountPoints[mountPoint];
			const regex = new RegExp(`^${mountPoint}`, `i`);

			if (path.match(regex)) { return mounted.requestHandler; }
		}

		throw new Error(`There is no request handler mounted on the URL "${path}" that can handle the request.`);

	}

	/*
	 * Set the status of the response.
	 */
	__status (res, code) {
		res.statusCode = code;
		return res;
	}

	/*
	 * Allows setting multiple headers at once by passing in dictionary.
	 */
	__setHeaders (res, headers) {

		for (const key in headers) {
			if (!headers.hasOwnProperty(key)) { continue; }

			const value = headers[key];
			res.setHeader(key, value);
		}

		return res;

	}

	/*
	 * Helper method for redirecting the request to a new URL.
	 */
	__redirect (res, code, redirectUrl) {

		res.status(code);
		res.setHeaders({ 'Location': redirectUrl });
		res.end(`Redirect ${code}: ${redirectUrl}`);

	}

	/*
	 * Converts the given data to JSON and sends it.
	 */
	__respond (res, data, formatJson = true) {

		this.__dep(`sharedLogger`).verbose({
			text: `Sending response to incoming request...`,
			responseBody: data || null,
		});

		// If we aren't formatting as JSON just output the data as-is.
		if (!formatJson) { return res.end(data); }

		const json = JSON.stringify(data);

		res.setHeaders({ 'Content-Type': `application/json` });
		return res.end(json);

	}

};
