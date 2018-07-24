'use strict';

/*
 * SCHEMA: Task
 */

module.exports = function (Schema, Property, Reference) {

	return new Schema(`Task`, {
		hash: new Property(`string`, null),
		_user: new Reference(`User`),
		_admin: new Reference(`User`, null),
		actions: [ new Property(`flexible`) ],
		lastRunDate: new Property(`date`, null),
		nextRunDate: new Property(`date`, 0),
		runEvery: new Property(`string`, null),
		runTime: new Property(`string`, null),
		ignoreDays: [ new Property(`integer`) ],
		maxRuns: new Property(`integer`, 0),
		numRuns: new Property(`integer`, 0),
		allowConcurrent: new Property(`boolean`),
		lockedSinceDate: new Property(`date`, null),
		dateCreated: new Property(`date`, 0),
	});

};
