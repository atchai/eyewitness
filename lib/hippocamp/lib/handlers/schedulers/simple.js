'use strict';

/*
 * SCHEDULER: Simple
 */

const extender = require(`object-extender`);
const moment = require(`moment`);
const SchedulerBase = require(`./schedulerBase`);
const utilities = require(`../../modules/utilities`);

module.exports = class SchedulerSimple extends SchedulerBase {

	/*
	 * Instantiates the handler.
	 */
	constructor (_options) {

		// Configure the handler.
		super(`scheduler`, `simple`);

		// Default options.
		this.options = extender.defaults({
			executeEvery: `5 minutes`,
			tasks: null,
			isDisabled: false,
		}, _options);

		this.isDisabled = this.options.isDisabled;
		this.maxLockTime = moment.duration(60, `seconds`).asMilliseconds();

		// Caches.
		this.timeoutId = null;
		this.executionFrequency = null;
		this.executionUnits = null;

		// Split out the different elements from the "execute every" string.
		const { frequency, units } = utilities.parseFrequencyString(this.options.executeEvery);
		if (!frequency || !units) { throw new Error(`Invalid execution frequency "${this.options.executeEvery}".`); }

		this.executionFrequency = frequency;
		this.executionUnits = units;

	}

	/*
	 * Add an array of tasks to the scheduler.
	 */
	async __addTasks (tasks, timezoneUtcOffset = 0) {

		if (!Array.isArray(tasks)) { return; }

		const addTaskPromises = tasks.map(task => this.__addTask(task, timezoneUtcOffset));

		await Promise.all(addTaskPromises);

	}

	/*
	 * Add a single task to the scheduler.
	 */
	async addTask (taskId, userId, actions, _options, timezoneUtcOffset = 0) {

		const options = extender.merge({
			taskId,
			userId,
			actions,
		}, _options);

		await this.__addTask(options, timezoneUtcOffset);

	}

	/*
	 * Add a single task to the scheduler.
	 */
	async __addTask (_options, timezoneUtcOffset) {

		if (this.checkIfDisabled()) { return; }

		const database = this.__dep(`database`);
		const sharedLogger = this.__dep(`sharedLogger`);

		const options = extender.defaults({
			taskId: null,
			userId: null,
			adminId: null,
			actions: null,
			nextRunDate: null,
			runEvery: null,
			runTime: null,
			ignoreDays: [],
			maxRuns: 0,
			allowConcurrent: false,
		}, _options);

		// Create the definition for the task which matches the database model.
		const taskDefinition = {
			hash: options.taskId,
			_user: options.userId,
			_admin: options.adminId,
			actions: options.actions,
			nextRunDate: (options.nextRunDate ? moment(options.nextRunDate).toDate() : null),
			runEvery: options.runEvery,
			runTime: options.runTime,
			numRuns: 0,
			ignoreDays: options.ignoreDays,
			maxRuns: options.maxRuns,
			allowConcurrent: options.allowConcurrent,
			dateCreated: Date.now(),
		};

		// Calculate the next run date.
		if (!taskDefinition.nextRunDate) {
			taskDefinition.nextRunDate = this.__calculateTaskNextRunDate(taskDefinition, timezoneUtcOffset);
		}

		const hash = taskDefinition.hash;
		const forWhichUserStr = (options.userId ? `user ${options.userId}` : `all users`);

		sharedLogger.verbose({
			text: `Adding task "${hash}" to simple scheduler for "${forWhichUserStr}".`,
			taskDefinition,
		});

		// Persist to database, updating an existing task or inserting as appropriate.
		await database.update(`Task`, {
			hash: taskDefinition.hash,
			_user: taskDefinition._user,
		}, taskDefinition, {
			upsert: true,
			useConditions: true,
		});

	}

	/*
	 * Start the scheduler.
	 */
	async start () {

		const database = this.__dep(`database`);
		const sharedLogger = this.__dep(`sharedLogger`);

		// Check we have a database object.
		if (!database) { throw new Error(`Database missing! You must configure this scheduler after your database.`); }

		// Add in pre-configured tasks, if any.
		await this.__addTasks(this.options.tasks, 0); // Timezone offset not supported for pre-configured tasks.

		// Start immediately.
		sharedLogger.debug(`Started simple scheduler.`);
		this.__enqueueNextRun(true);

	}

	/*
	 * Sets up the scheduler to run after a timeout, or immediately.
	 */
	__enqueueNextRun (immediate = false) {

		// Are we running the scheduler immediately?
		if (immediate) {
			this.__execute();
			return;
		}

		// Get the number of milliseconds until the next run of the scheduler.
		const nextExecutionTime = moment.utc().add(this.executionFrequency, this.executionUnits);
		const timeoutMilliseconds = nextExecutionTime.diff(moment.utc());

		// Add a new timeout.
		if (this.timeoutId) { clearTimeout(this.timeoutId); }
		this.timeoutId = setTimeout(this.__execute.bind(this), timeoutMilliseconds);

	}

	/*
	 * Run the scheduler. Figure out which tasks need executing and then execute them.
	 */
	async __execute () {
		/* eslint no-await-in-loop: 0 */

		if (this.checkIfDisabled()) { return; }

		const database = this.__dep(`database`);
		const sharedLogger = this.__dep(`sharedLogger`);
		const workflowManager = this.__dep(`workflowManager`);

		try {

			sharedLogger.verbose(`Executing a simple scheduler run.`);

			// Get the tasks from the database.
			const tasks = await database.find(`Task`, {
				nextRunDate: { $lte: Date.now() },
			}, {
				sort: { nextRunDate: `asc` },
			});

			const userCache = {};
			const tasksToExecute = [];
			const currentIsoWeekday = moment().utc().isoWeekday();

			// Prepare all the tasks we will be executing.
			for (let index = 0; index < tasks.length; index++) {
				const task = tasks[index];
				const userId = task._user;
				const sendMessage = workflowManager.sendMessage.bind(workflowManager);
				let recUser = null;

				// Only query the user if one was specified.
				if (userId) {
					recUser = userCache[userId];
					if (!recUser) { // Not found in cache.
						recUser = (userCache[userId] = await database.get(`User`, { _id: userId }));
						if (!recUser) {
							throw new Error(`Missing user [${userId}] required for schedule task [${task._id}] - was he deleted?`);
						}
					}
				}

				if (Array.isArray(task.ignoreDays) && task.ignoreDays.includes(currentIsoWeekday)) {
					// ignore the task today
					// set the nextRunDate for the task, without running it
					const timezoneUtcOffset = recUser ? (recUser.profile.timezoneUtcOffset || 0) : 0;
					const nextRunDate = this.__calculateTaskNextRunDate(task, timezoneUtcOffset);
					await database.update(`Task`, task._id, { nextRunDate });
					continue;
				}

				tasksToExecute.push({ task, recUser, sendMessage });
			}

			// Execute all the tasks in order.
			const taskPromiseChain = tasksToExecute.reduce(
				(chain, taskToExecute) => chain.then(this.__executeTask(taskToExecute)), // eslint-disable-line promise/prefer-await-to-then
				Promise.resolve()
			);

			await taskPromiseChain;

		}
		catch (err) {
			sharedLogger.error(`Failed to execute a simple scheduler run because of "${err}".`);
		}
		finally {
			this.__enqueueNextRun();
		}

	}

	/*
	 * Execute a single task, and either increment the number of runs or remove it from the database.
	 */
	async __executeTask ({ task, recUser }) {

		const database = this.__dep(`database`);
		const workflowManager = this.__dep(`workflowManager`);

		// Lock the task so no other instances can run it.
		if (!task.allowConcurrent) {

			const lockEndDate = moment.utc(task.lockedSinceDate || 0).add(this.maxLockTime, `milliseconds`);

			// Task is still locked so we don't run it this time.
			if (lockEndDate.isSameOrAfter(moment.utc())) {
				return;
			}

			task.numRuns++;

			// Otherwise lock the task ourselves.
			await database.update(`Task`, task._id, {
				lockedSinceDate: Date.now(),
				numRuns: task.numRuns,
			});
		}
		else { // increment numRuns and nextRunDate before task in case the task is running concurrently
			task.numRuns++;

			const timezoneUtcOffset = recUser ? (recUser.profile.timezoneUtcOffset || 0) : 0;
			const nextRunDate = this.__calculateTaskNextRunDate(task, timezoneUtcOffset);

			await database.update(`Task`, task._id, {
				numRuns: task.numRuns,
				nextRunDate,
			});
		}

		// Execute all the actions in the task.
		await workflowManager.executeActions(`scheduled`, `task`, task.actions, recUser);

		const timezoneUtcOffset = recUser ? (recUser.profile.timezoneUtcOffset || 0) : 0;
		const nextRunDate = this.__calculateTaskNextRunDate(task, timezoneUtcOffset);

		// Update the task with the next run date.
		if (nextRunDate) {
			await database.update(`Task`, task._id, {
				lockedSinceDate: null,
				lastRunDate: Date.now(),
				nextRunDate,
			});
		}

		// Otherwise nuke the task if we are never going to run it again.
		else {
			await database.delete(`Task`, task._id);
		}

	}

	/*
	 * Returns the next run date of the task, or null if the task was only run-once or has reached its maximum runs.
	 */
	__calculateTaskNextRunDate (task, timezoneUtcOffset) {

		const utcOffsetMinutes = this.__convertTimezoneOffsetToMinutes(timezoneUtcOffset);

		// Task has reached its maximum runs.
		if (task.maxRuns && task.numRuns >= task.maxRuns) { return null; }

		// This was a run-once task if no run frequency or units are specified.
		const { frequency, units } = utilities.parseFrequencyString(task.runEvery);
		if (!frequency || !units) { return null; }

		// Calculate the time we need to run this task again.
		const nextRunDate = moment().utcOffset(utcOffsetMinutes, false).add(frequency, units);

		// The first run should be at the start of the unit given (e.g. at the start of the hour).
		if (!task.numRuns) { nextRunDate.startOf(units); }

		// Do we need to run at a specific time of day?
		const [ runHours, runMinutes ] = (task.runTime || ``).split(/:/g) || [ null, null ];
		if (runHours && runMinutes) {
			nextRunDate.hours(runHours);
			nextRunDate.minutes(runMinutes);
		}

		// Return a JavaScript date.
		return nextRunDate.toDate();

	}

	__convertTimezoneOffsetToMinutes (timezoneUtcOffset) { // also validates timezone

		// offset usually a whole number but not all timezones are whole hours, so use float
		if (Number.isNaN(Number.parseFloat(timezoneUtcOffset))) {
			throw new Error(`timezoneUtcOffset must be a number, not "${timezoneUtcOffset}"`);
		}

		return timezoneUtcOffset * 60;

	}

	/**
	 * Reschedules all tasks for a user based on the user's new timezone.
	 */
	async rescheduleAllTasksForUser (userId, newtimezoneUtcOffset) {
		const database = this.__dep(`database`);

		const utcOffsetMinutes = this.__convertTimezoneOffsetToMinutes(newtimezoneUtcOffset);

		// Get the tasks from the database.
		const recTasks = await database.find(`Task`, { _user: userId }, { });

		for (const recTask of recTasks) {
			const nextRunDate = moment(recTask.nextRunDate).utcOffset(utcOffsetMinutes, true).toDate();
			await database.update(`Task`, recTask._id, { nextRunDate });
		}
	}

	/*
	 * Removes all scheduled tasks for the given user without executing them.
	 */
	async removeAllTasksForUser (userId) {
		const database = this.__dep(`database`);
		await database.deleteWhere(`Task`, { _user: userId });
	}

};
