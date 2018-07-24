'use strict';

/*
 * Adds a scheduled task.
 */
module.exports = async function __executeActionScheduleTask (action, recUser) {

	const scheduler = this.__dep(`scheduler`);
	const task = action.task;

	if (!scheduler) {
		throw new Error(`You cannot schedule a task because no scheduler handler has been configured.`);
	}

	if (!task.taskId) {
		throw new Error(`Cannot schedule a task without a unique task ID.`);
	}

	if (!task.nextRunDate && !task.runEvery) {
		throw new Error(`Cannot schedule a task without one of "nextRunDate" or "runEvery".`);
	}

	const userId = (recUser ? recUser._id.toString() : null);
	const timezoneUtcOffset = (recUser && recUser.profile ? (recUser.profile.timezoneUtcOffset || 0) : 0);

	await scheduler.addTask(task.taskId, userId, task.actions, {
		nextRunDate: task.nextRunDate,
		runEvery: task.runEvery,
		runTime: task.runTime,
		maxRuns: task.maxRuns,
		ignoreDays: task.ignoreDays || [],
		allowConcurrent: task.allowConcurrent,
	}, timezoneUtcOffset);

};
