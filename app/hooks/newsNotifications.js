'use strict';

/*
 * HOOK: News Notifications
 */

const moment = require(`moment`);
const breakingNews = require(`../modules/breakingNews`);

/*
 * The hook itself.
 */
module.exports = async function newsNotifications (action, variables, resources) {

	const { database, MessageObject, sendMessage, sharedLogger } = resources;
	const notBeforeHour = variables.provider.notifications.notBeforeHour;
	const notAfterHour = variables.provider.notifications.notAfterHour;
	const now = moment.utc().add(variables.provider.timezoneOffset, `hours`);
	const hours = now.hours();

	// Skip if we're outside the allowed notification hours.
	if (hours < notBeforeHour || hours > notAfterHour) { return; }

	sharedLogger.verbose(`Sending breaking news...`);

	await breakingNews.sendOutstanding(database, MessageObject, sendMessage);

};
