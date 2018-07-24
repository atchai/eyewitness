'use strict';

/*
 * HIPPOCAMP
 */

/* eslint global-require: 0 */
/* eslint no-process-exit: 0 */
/* eslint node/no-unpublished-require: 0 */

const packageJson = require(`../package.json`);
const path = require(`path`);
const MiddlewareEngine = require(`middleware-engine`);
const extender = require(`object-extender`);
const semver = require(`semver`);
const Handler = require(`./handlers/handlerBase`);
const Server = require(`./server/server`);
const continueConversationMiddleware = require(`./middleware/continueConversation`);
const createShellUserMiddleware = require(`./middleware/createShellUser`);
const getExistingUserMiddleware = require(`./middleware/getExistingUser`);
const logMessageMiddleware = require(`./middleware/logMessage`);
const customInputHandlerMiddleware = require(`./middleware/customInputHandlerMiddleware`);
const parseCommandMiddleware = require(`./middleware/parseCommand`);
const populateMessageVariablesMiddleware = require(`./middleware/populateMessageVariables`);
const refreshUserProfileMiddleware = require(`./middleware/refreshUserProfile`);
const trackUserMiddleware = require(`./middleware/trackUser`);
const saveMessageMiddleware = require(`./middleware/saveMessage`);
const markAsHumanToHumanMiddleware = require(`./middleware/markAsHumanToHuman`);
const trackifyLinksMiddleware = require(`./middleware/trackifyLinks`);
const MessageObject = require(`./modules/messageObject`);
const sharedLogger = require(`./modules/sharedLogger`);
const WorkflowManager = require(`./workflow/workflowManager`);
const LoggerTerminal = require(`./handlers/loggers/terminal`);

module.exports = class Hippocamp {

	/*
	 * Instantiates a new chatbot engine.
	 */
	constructor (_options) { // eslint-disable-line max-statements

		// If there is no listener for unhandled promise rejections then we add our own to output a stack trace and quit.
		if (!process.eventNames().includes(`unhandledRejection`)) {

			process.on(`unhandledRejection`, err => { // eslint-disable-line promise/prefer-await-to-callbacks
				/* eslint no-console: 0 */
				console.error(``);
				console.error(`Unhandled promise rejection!`);
				console.error(`This should NEVER happen - promise rejections MUST be handled correctly.`);
				console.error(``);
				console.error(err.stack);
				process.exit(1);
			});

		}

		// Version check.
		const nodeVersion = process.versions.node;
		const requiredVersion = packageJson.engines.node;

		if (!semver.satisfies(nodeVersion, requiredVersion)) {
			throw new Error(`Your version of Node (${nodeVersion}) is not supported! Please upgrade to ${requiredVersion}.`);
		}

		// Default options for this class.
		this.options = extender.defaults({
			packageJsonPath: null,
			environment: process.env.NODE_ENV || `development`,
			baseUrl: null,
			whitelistedDomains: null,
			port: 5000,
			saveMessagesToDatabase: true,
			enableUserProfile: true,
			enableUserTracking: true,
			enableEventTracking: true,
			enableMessageTracking: true,
			enableNlp: false,
			refreshUsersEvery: `1 week`,
			whitelistProfileFields: null,
			getStartedButton: `Get Started`,
			greetingText: null,
			misunderstoodText: `Whoops! I'm not sure what you mean...`,
			misunderstoodOptions: [{
				label: `Restart`,
			}],
			misunderstoodFlowUri: null,
			linkTracking: {
				enabled: false,
				serverUrl: null,
				analyticsEventName: `link-visited`,
			},
			menu: null,
			messageVariables: {},
			allowUserTextReplies: true,
			sendMessageDelay: {
				fixedDelay: 1,
				avgWordsPerMin: 200,
				buttonDelay: 1,
				randomness: 0.10,
				minDelay: 0,
				maxDelay: 5,
			},
			directories: {
				commands: null,
				flows: null,
				hooks: null,
				matches: null,
				models: null,
				modelsExtensions: null,
				webviews: null,
			},
			debugMode: false,
		}, _options);

		// Complain if any of the essential options are not configured.
		if (!this.options.packageJsonPath) { throw new Error(`You must provide the path to your package.json file.`); }
		if (!this.options.environment) { throw new Error(`The environment property must be a valid environment name.`); }
		if (!this.options.baseUrl) { throw new Error(`You must specify a base URL for the bot's server.`); }
		if (!this.options.port) { throw new Error(`You must specify a port for the bot's server.`); }

		// Load their package JSON so we can add their app's info to the message variables.
		const appPackageJson = require(path.join(process.cwd(), this.options.packageJsonPath));
		this.appVersion = appPackageJson.version;

		// Add some extra values into the message variables.
		this.options.messageVariables = extender.merge({
			appInfo: {
				name: appPackageJson.name,
				version: appPackageJson.version,
				environment: this.options.environment,
			},
			engineInfo: {
				name: packageJson.name,
				version: packageJson.version,
			},
			baseUrl: this.options.baseUrl,
			port: this.options.port,
		}, this.options.messageVariables);

		// In debug mode we want access to stack traces that cross async boundaries.
		if (this.options.debugMode) {
			/* eslint camelcase: 0 */
			const longjohn = require(`longjohn`);
			longjohn.async_trace_limit = -1; // Unlimited.
		}

		// Initialise server (must be before adapters).
		this.server = new Server(this.options);

		// Initialise workflow manager (must be before adapters).
		const triggerEvent = this.triggerEvent.bind(this);
		this.workflowManager = new WorkflowManager(this.options, triggerEvent);

		// Important caches for the handlers.
		this.adapters = {};
		this.analytics = {};
		this.database = null;
		this.loggers = {};
		this.periodics = {};
		this.customInputHandlers = {};
		this.scheduler = null;
		this.nlp = null;
		this.eventListeners = {};

	}

	/*
	 * Returns a reference to the given handler.
	 */
	static require (filename) {
		return require(`./handlers/${filename}`);
	}

	/*
	 * Returns a reference to the given test helper.
	 */
	static requireTestHelper (filename) {
		return require(`../tests/includes/${filename}`);
	}

	/*
	 * Returns an object of default Hippocamp models by key (based on filename).
	 */
	static async getDefaultModelsByKey () {
		return new WorkflowManager({}).getDefaultModelsByKey();
	}

	/*
	 * Returns an array of the default Hippocamp models.
	 */
	static async getDefaultModels () {
		return new WorkflowManager({}).getDefaultModels();
	}

	/*
	 * Injects some common dependencies into a module returned by require().
	 */
	static prepareDependencies (module) {

		if (!(module instanceof MiddlewareEngine)) { return module; }

		module.requires().forEach(requirement => {

			let dependency;

			switch (requirement) {
				case `MessageObject`: dependency = MessageObject; break;
				case `sharedLogger`: dependency = sharedLogger; break;
				default: break;
			}

			if (dependency) { module.inject(requirement, dependency); }

		});

		return module;

	}

	/*
	 * Configures the given handler.
	 */
	async configure (handler) {

		if (!(handler instanceof Handler)) { throw new Error(`You can only configure handler objects.`); }

		const handlerType = handler.getType();

		switch (handlerType) {
			case `adapter`: await this.__configureAdapterHandler(handler); break;
			case `analytics`: await this.__configureAnalyticsHandler(handler); break;
			case `custom`: this.__configureCustomInputHandler(handler); break;
			case `database`: this.__configureDatabaseHandler(handler); break;
			case `logger`: this.__configureLoggerHandler(handler); break;
			case `nlp`: this.__configureNlpHandler(handler); break;
			case `periodic`: this.__configurePeriodicHandler(handler); break;
			case `scheduler`: this.__configureSchedulerHandler(handler); break;
			default: throw new Error(`Invalid handler type of "${handlerType}".`);
		}

	}

	/*
	 * Configure the given adapter handler if it hasn't already been configured.
	 */
	async __configureAdapterHandler (adapter) {

		const handlerId = adapter.getHandlerId();

		// Doesn't make sense to allow the same adapter to be configured more than once.
		if (this.adapters[handlerId]) {
			throw new Error(`You have already configured the "${handlerId}" adapter.`);
		}

		this.adapters[handlerId] = adapter;

		// Allow the adapter to accept incoming requests.
		this.server.mount(`/api/adapter/${handlerId}`, adapter.handleRequest.bind(adapter));

		// Inject dependencies.
		adapter.inject(`database`, this.database);
		adapter.inject(`sharedLogger`, sharedLogger);
		adapter.inject(`MessageObject`, MessageObject);
		adapter.inject(`adapters`, this.adapters);

		// Prepare the middleware.
		const triggerEvent = this.triggerEvent.bind(this);

		const incomingMiddleware = [
			logMessageMiddleware(sharedLogger),
			getExistingUserMiddleware(this.database, sharedLogger),
			createShellUserMiddleware(this.database, sharedLogger, triggerEvent, this.options),
			refreshUserProfileMiddleware(this.database, sharedLogger, triggerEvent, this.options),
			trackUserMiddleware(this.database, sharedLogger, this.workflowManager, this.options),
			saveMessageMiddleware(this.database, sharedLogger, triggerEvent, this.workflowManager, this.options),
			parseCommandMiddleware(this.database, sharedLogger, this.workflowManager),
			customInputHandlerMiddleware(sharedLogger, this.customInputHandlers),
			continueConversationMiddleware(this.database, sharedLogger, this.workflowManager),
			markAsHumanToHumanMiddleware(this.database, sharedLogger, this.options),
		];

		const outgoingMiddleware = [
			getExistingUserMiddleware(this.database, sharedLogger),
			populateMessageVariablesMiddleware(this.database, sharedLogger, this.options),
			saveMessageMiddleware(this.database, sharedLogger, triggerEvent, this.workflowManager, this.options),
			trackifyLinksMiddleware(sharedLogger, this.options),
			logMessageMiddleware(sharedLogger),
		];

		// Configure the middleware.
		adapter.configure(`incoming-message`, ...incomingMiddleware);
		adapter.configure(`outgoing-message`, ...outgoingMiddleware);

		// Inject a reference to the adapter into the workflow manager.
		this.workflowManager.inject(`adapter-${handlerId}`, adapter);

		// Finally, initialise the adapter with the configured Hippocamp options.
		await adapter.init(this.options);

	}

	/*
	 * Configure the given analytics handler if one hasn't already been configured.
	 */
	__configureAnalyticsHandler (handler) {

		const handlerId = handler.getHandlerId();

		// Doesn't make sense to allow more than one analytics handler to be configured.
		if (this.analytics[handlerId]) {
			throw new Error(`You have already configured the "${handlerId}" analytics handler.`);
		}

		this.analytics[handlerId] = handler;

		// Inject dependencies.
		handler.inject(`sharedLogger`, sharedLogger);

	}

	/*
	 * Configure the given database handler if one hasn't already been configured.
	 */
	__configureDatabaseHandler (handler) {

		// Doesn't make sense to allow more than one database handler to be configured.
		if (this.database) {
			throw new Error(`You have already configured the "${this.database.getHandlerId()}" database handler.`);
		}

		this.database = handler;

		// Inject dependencies.
		handler.inject(`sharedLogger`, sharedLogger);

	}

	/*
	 * Configure the given logger handler if one hasn't already been configured.
	 */
	__configureLoggerHandler (logger) {

		const handlerId = logger.getHandlerId();

		// Doesn't make sense to allow the same logger to be configured more than once.
		if (this.loggers[handlerId]) {
			throw new Error(`You have already configured the "${handlerId}" logger.`);
		}

		this.loggers[handlerId] = logger;

		// Make the logger available to all other modules by taking advantage of Node's module caching.
		sharedLogger.add(logger);

	}

	/*
	 * Configure the given NLP handler if one hasn't already been configured.
	 */
	__configureNlpHandler (handler) {

		// Doesn't make sense to allow more than one NLP handler to be configured.
		if (this.nlp) {
			throw new Error(`You have already configured the "${this.nlp.getHandlerId()}" NLP handler.`);
		}

		this.nlp = handler;

		// Inject dependencies.
		handler.inject(`sharedLogger`, sharedLogger);

	}

	/*
	 * Configure the given periodic handler if one hasn't already been configured.
	 */
	__configurePeriodicHandler (periodic) {

		const handlerId = periodic.getHandlerId();

		// Doesn't make sense to allow the same periodic handler to be configured more than once.
		if (this.periodics[handlerId]) {
			throw new Error(`You have already configured the "${handlerId}" logger.`);
		}

		this.periodics[handlerId] = periodic;

		// Inject dependencies.
		periodic.inject(`sharedLogger`, sharedLogger);
		periodic.inject(`hippocamp`, this);
		periodic.inject(`database`, this.database);
		periodic.inject(`scheduler`, this.scheduler);
		periodic.inject(`adapter`, this.adapters[periodic.getAdapterId()]);

	}

	/*
	 * Configure the given custom input handler if one hasn't already been configured.
	 */
	__configureCustomInputHandler (customInputHandler) {

		const handlerId = customInputHandler.getHandlerId();

		// Doesn't make sense to allow the same custom input handler to be configured more than once.
		if (this.customInputHandlers[handlerId]) {
			throw new Error(`You have already configured the "${handlerId}" logger.`);
		}

		this.customInputHandlers[handlerId] = customInputHandler;

		// Inject dependencies.
		customInputHandler.inject(`sharedLogger`, sharedLogger);
		customInputHandler.inject(`database`, this.database);

	}

	/*
	 * Configure the given scheduler handler if one hasn't already been configured.
	 */
	__configureSchedulerHandler (handler) {

		// Doesn't make sense to allow more than one scheduler handler to be configured.
		if (this.scheduler) {
			throw new Error(`You have already configured the "${this.scheduler.getHandlerId()}" scheduler handler.`);
		}

		this.scheduler = handler;

		// Inject dependencies.
		handler.inject(`sharedLogger`, sharedLogger);
		handler.inject(`database`, this.database);
		handler.inject(`workflowManager`, this.workflowManager);

	}

	/*
	 * Start the chatbot.
	 */
	async start () {

		try {

			// Always ensure we have the terminal logger configured even if the app hasn't configured it.
			if (!Object.keys(this.loggers).includes(`terminal`)) { this.configure(new LoggerTerminal()); }

			sharedLogger.info(`Starting application...`);
			sharedLogger.debug(`${packageJson.name} engine version: ${packageJson.version}.`);

			// Startup checks.
			if (!this.database) { throw new Error(`You must configure a database handler.`); }
			if (!Object.keys(this.adapters).length) { throw new Error(`You must configure at least one adapter handler.`); }

			// Preparation.
			this.__prepareConfiguredDirectories();
			await this.__prepareServer();
			await this.__prepareWorkflowManager();

			// Go!
			await this.server.listen();
			if (this.scheduler) { this.scheduler.start(); }
			Object.values(this.periodics).forEach(periodic => periodic.start());

			// When running a test we need to tell the parent process that we're ready.
			if (process.env.TEST_NAME) { process.send({ ready: true }); }

		}
		catch (err) {
			await sharedLogger.fatal(err); // Wait for error log to get written.
			process.exit(1); // We must exit the process at this point.
		}

	}

	/*
	 * Ensure all configured directories have absolute paths.
	 */
	__prepareConfiguredDirectories () {

		sharedLogger.debug(`Preparing configured directories...`);

		Object.keys(this.options.directories).forEach(key => {
			if (this.options.directories[key] && !path.isAbsolute(this.options.directories[key])) {
				this.options.directories[key] = path.join(process.cwd(), this.options.directories[key]);
			}
		});

		sharedLogger.verbose({
			text: `Configured directories.`,
			directories: this.options.directories,
		});

	}

	/*
	 * Setup steps for the server.
	 */
	__prepareServer () {

		this.server.inject(`sharedLogger`, sharedLogger);

		this.server.mount(`/health-check`, (req, res) => res.respond({ healthy: true, version: this.appVersion }));
		this.server.mount(`/webview`, this.workflowManager.handleWebviewRequests.bind(this.workflowManager));
		this.server.mount(`/track-link`, this.workflowManager.handleLinkTrackingRequests.bind(this.workflowManager));
		this.server.mount(`/api/flow/reload-dynamic`, this.workflowManager.reloadDynamicFlows.bind(this.workflowManager));

	}

	/*
	 * Setup steps for the workflow manager.
	 */
	async __prepareWorkflowManager () {

		// Inject the dependencies the workflow manager requires.
		this.workflowManager.inject(`sharedLogger`, sharedLogger);
		this.workflowManager.inject(`MessageObject`, MessageObject);
		this.workflowManager.inject(`analytics`, this.analytics);
		this.workflowManager.inject(`database`, this.database);
		this.workflowManager.inject(`nlp`, this.nlp);
		this.workflowManager.inject(`scheduler`, this.scheduler);

		// Start the workflow manager.
		await this.workflowManager.start(this.options.directories);

	}

	/*
	 * Register new event handler(s).
	 */
	on (eventKey, _handlers) {

		const handlers = (Array.isArray(_handlers) ? _handlers : [ _handlers ]);

		// Add all the handler(s).
		this.eventListeners[eventKey] = this.eventListeners[eventKey] || [];
		this.eventListeners[eventKey].push(...handlers);

	}

	/*
	 * Calls all of the event listeners registered to the event of the given name.
	 *
	 * @callback triggerEvent
	 * @param {string} eventName
	 * @param {Object} data
	 */
	async triggerEvent (eventName, data) {

		const handlers = this.eventListeners[eventName] || [];

		if (!handlers || !handlers.length) {
			sharedLogger.debug(`No event listener(s) to consume event "${eventName}".`);
			return;
		}

		sharedLogger.debug(`Executing ${handlers.length} event listener(s) for event "${eventName}".`);

		// Execute all the handlers in the order they were added.
		for (let index = 0; index < handlers.length; index++) {
			const handler = handlers[index];

			try {
				await handler(data); // eslint-disable-line no-await-in-loop
			}
			catch (err) {
				sharedLogger.error(
					`Unable to execute event listener "${index}:${handler.name}" for event "${eventName}" because of "${err}".`
				);
			}
		}

	}

};
