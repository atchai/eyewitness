'use strict';

/*
 * WORKFLOW MANAGER
 * The main entry point for the Workflow Manager class. When instantiated, this class includes the methods from the
 * various sub-modules so they can be accessed with 'this'.
 */

const MiddlewareEngine = require(`middleware-engine`);
const extender = require(`object-extender`);
const workflowActions = require(`./actions`);
const workflowCommands = require(`./commands`);
const workflowFileManagement = require(`./fileManagement`);
const workflowFlows = require(`./flows`);
const workflowHooks = require(`./hooks`);
const workflowLinkTracking = require(`./linkTracking`);
const workflowMatching = require(`./matching`);
const workflowMemory = require(`./memory`);
const workflowMiscellaneous = require(`./miscellaneous`);
const workflowMisunderstood = require(`./misunderstood`);
const workflowModels = require(`./models`);
const workflowPrompts = require(`./prompts`);
const workflowTracking = require(`./tracking`);
const workflowVariables = require(`./variables`);
const workflowWebviews = require(`./webviews`);

module.exports = class WorkflowManager extends MiddlewareEngine {

	/*
	 * Instantiate a new workflow manager.
	 */
	constructor (_options, _triggerEvent) {

		// Configure the middleware engine.
		super();

		// Default values for just the options we care about.
		this.options = extender.defaults({
			baseUrl: null,
		}, _options);

		// Maintain the scope of trigger event from the Hippocamp class.
		this.triggerEvent = function (...args) {
			return _triggerEvent(...args);
		};

		// In-memory caches.
		this.commands = [];
		this.hooks = {};
		this.matchFiles = {};
		this.flows = {};
		this.webviews = {};
		this.webviewLayoutHtml = null;

		// Assign methods from sub-modules.
		Object.assign(
			this,
			workflowActions,
			workflowCommands,
			workflowFileManagement,
			workflowFlows,
			workflowHooks,
			workflowLinkTracking,
			workflowMatching,
			workflowMemory,
			workflowMiscellaneous,
			workflowMisunderstood,
			workflowModels,
			workflowPrompts,
			workflowTracking,
			workflowVariables,
			workflowWebviews
		);

	}

	/*
	 * Start the workflow manager by loading in all the required files.
	 */
	async start (directories) {

		const database = this.__dep(`database`);
		const sharedLogger = this.__dep(`sharedLogger`);

		try {

			// Setup the database connection before we do anything else.
			await this.__loadModels(directories.models, directories.modelsExtensions);
			await database.connect();

			// Then load all other resources in parallel.
			await Promise.all([
				this.__loadCommands(directories.commands),
				this.__loadFlows(directories.flows),
				this.__loadHooks(directories.hooks),
				this.__loadMatchFiles(directories.matches),
				this.__loadWebviews(directories.webviews),
			]);

		}
		catch (err) {
			sharedLogger.fatal(err.stack);
			throw new Error(`Failed to start the workflow manager because of "${err}".`);
		}

	}

	/*
	 * Logs out the reason we are skipping executing a function.
	 */
	skipIfBotDisabled (functionInfo, recUser) {

		// Don't skip if no bot properties are set on the user record.
		if (!recUser || !recUser.bot) { return false; }

		const sharedLogger = this.__dep(`sharedLogger`);
		const userId = recUser._id;
		let reason = null;

		// Figure out the reason for skipping, if any.
		if (recUser.bot.removed) { reason = `the bot has been removed by the user "${userId}"`; }
		else if (recUser.bot.disabled) { reason = `the bot is disabled for the user "${userId}"`; }

		// Don't skip if no reason to skip was found.
		if (!reason) { return false; }

		// Yes we are skipping.
		sharedLogger.debug(`Skipping ${functionInfo} because ${reason}.`);
		return true;

	}

};
