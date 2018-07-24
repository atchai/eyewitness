'use strict';

/*
 * PERIODIC BASE.
 *
 * A periodic handler represents some task that needs to run on a periodically, such
 * as fetching an external API.
 *
 * Any sub-class must override __startPeriodic and __executePeriodic
 */

const extender = require(`object-extender`);
const moment = require(`moment`);
const HandlerBase = require(`../handlerBase`);
const utilities = require(`../../modules/utilities`);

module.exports = class PeriodicBase extends HandlerBase {

	/*
	 * Initialises a new periodic task handler.
	 */
	constructor (type, handlerId, _options) {
		super(type, handlerId);

		// Default options.
		this.options = extender.defaults({
			executeEvery: `1 minutes`,
			isDisabled: false,
			adapterId: `facebook`,
		}, _options);

		this.isDisabled = this.options.isDisabled;

		// Split out the different elements from the "execute every" string.
		const { frequency, units } = utilities.parseFrequencyString(this.options.executeEvery);
		if (!frequency || !units) { throw new Error(`Invalid execution frequency "${this.options.executeEvery}".`); }

		this.executionFrequency = frequency;
		this.executionUnits = units;

	}

	/*
	 * Start the periodic task.
	 */
	async start () {

		const sharedLogger = this.__dep(`sharedLogger`);

		// Start immediately.
		sharedLogger.debug(`Started periodic handler: ${this.getHandlerId()}`);

		// __startPeriodic must be implemented by the sub-class
		this.__startPeriodic();

		this.__enqueueNextRun();

	}

	/**
	 * Sub-class must override this. Runs once when the periodic handler is configured.
	 */
	async __startPeriodic () {
		throw new Error(`__startPeriodic must be overridden.`);
	}

	/*
	 * Sets up the scheduler to run after a timeout, or immediately.
	 */
	__enqueueNextRun (immediate = false) {

		// Are we running the periodic task immediately?
		if (immediate) {
			this.__execute();
		}
		else {
			// Get the number of milliseconds until the next run of the periodic.
			const nextExecutionTime = moment.utc().add(this.executionFrequency, this.executionUnits);
			const timeoutMilliseconds = nextExecutionTime.diff(moment.utc());

			// Add a new timeout.
			if (this.timeoutId) { clearTimeout(this.timeoutId); }
			this.timeoutId = setTimeout(this.__execute.bind(this), timeoutMilliseconds);
		}
	}

	/*
	 * Run the periodic task.
	 */
	async __execute () {
		/* eslint no-await-in-loop: 0 */

		if (this.checkIfDisabled()) { return; }

		const sharedLogger = this.__dep(`sharedLogger`);

		sharedLogger.verbose(`Executing periodic handler task: ${this.getHandlerId()}.`);

		// __executePeriodic must be implemented by the sub-class
		await this.__executePeriodic();

		this.__enqueueNextRun();

	}

	/**
	 * Sub-class must override this. This defines to task to be run periodically.
	 */
	async __executePeriodic () {
		throw new Error(`__executePeriodic must be overridden.`);
	}

	getAdapterId () {
		return this.options.adapterId;
	}

};
