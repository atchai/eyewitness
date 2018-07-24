'use strict';

/*
 * PERIODIC HANDLER: PROFILE FETCHER
 *
 * Fetches user profiles on a periodic basis.
 * Notifies the scheduler if a user's timezone changes.
 * User profiles may updated from elsewhere so this configures an event listener.
 *
 */

const PeriodicBase = require(`./periodicBase`);
const { refreshAllProfiles } = require(`../../modules/userProfileRefresher`);

module.exports = class ProfileFetcher extends PeriodicBase {

	/*
	 * Instantiates the handler.
	 */
	constructor (_options) {

		// Configure the handler.
		super(`periodic`, `profile-fetcher`, _options);

		this.options.refreshUsersEvery = _options.refreshUsersEvery || `30 minutes`;
		this.options.whitelistProfileFields = _options.whitelistProfileFields;

	}

	/*
	 * Sets up a listener to watch for user profile updates
	 */
	async __startPeriodic () {
		const sharedLogger = this.__dep(`sharedLogger`);
		const scheduler = this.__dep(`scheduler`);
		const hippocamp = this.__dep(`hippocamp`);

		hippocamp.on(`refreshed-user-profile`, this.__updatedTimezoneListener(scheduler, sharedLogger));

	}

	/**
	 * Gets an event listener for `refreshed-user-profile`, to check if timezone changed.
	 * If timezone changed, tell the scheduler to reschedule all tasks.
	 */
	__updatedTimezoneListener (scheduler, sharedLogger) {
		return async (eventData) => {
			const recUser = eventData.recUser;
			const oldTimezoneUtcOffset = eventData.oldProfile.timezoneUtcOffset;
			const newTimezoneUtcOffset = recUser.profile.timezoneUtcOffset;

			sharedLogger.verbose(`Checking for timezone changes for user ${recUser._id}:
				 ${oldTimezoneUtcOffset} => ${newTimezoneUtcOffset}`);

			if (oldTimezoneUtcOffset !== newTimezoneUtcOffset) {
				await scheduler.rescheduleAllTasksForUser(recUser._id, newTimezoneUtcOffset);
			}
		};
	}

	/*
	 * Fetches user profiles from chatbot platform and replaces them in the DB.
	 */
	async __executePeriodic () {

		const sharedLogger = this.__dep(`sharedLogger`);
		const database = this.__dep(`database`);
		const hippocamp = this.__dep(`hippocamp`);
		const adapter = this.__dep(`adapter`);

		sharedLogger.verbose(`Fetching user profiles`);

		const triggerEvent = hippocamp.triggerEvent.bind(hippocamp);

		refreshAllProfiles(adapter, database, sharedLogger, triggerEvent, {
			refreshEvery: this.options.refreshUsersEvery,
			whitelistProfileFields: this.options.whitelistProfileFields,
		});

	}

};
