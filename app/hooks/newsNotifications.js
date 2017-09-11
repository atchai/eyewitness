'use strict';

/*
 * HOOK: News Notifications
 */

const packageJson = require(`../../package.json`);
const config = require(`config-ninja`).use(`${packageJson.name}-${packageJson.version}-config`);

const moment = require(`moment`);

/*
 * Returns an array of all the user documents.
 */
async function loadAllUsers (database) {
	return await database.find(`User`, {});
}

/*
 * Returns a dictionary containing the latest unread article record and the user record for the given user, or null.
 */
async function getLatestUnreadArticleForUser (database, recUser) {

	const conditions = {
		_readByUsers: { $nin: [recUser._id] },
		isPriority: true,
	};
	const options = {
		sort: { articleDate: `desc` },
	};

	const recArticle = await database.get(`Article`, conditions, options);
	if (!recArticle) { return null; }

	return {
		recUser,
		recArticle,
	};

}

/*
 * Returns an array of users who have outstanding news (i.e. at least 1 unread article).
 */
function filterUsersWithOutstandingNews (outstandingNewsUsers) {
	return outstandingNewsUsers.filter(outstandingNewsUser => Boolean(outstandingNewsUser));
}

/*
 * The hook itself.
 */
module.exports = async function newsNotifications (action, variables, { database, sendMessage }) {

	const notBeforeHour = variables.provider.notifications.notBeforeHour;
	const notAfterHour = variables.provider.notifications.notAfterHour;
	const now = moment.utc().add(variables.provider.timezoneOffset, `hours`);
	const hours = now.hours();

	// Skip if we're outside the allowed notification hours.
	if (hours < notBeforeHour || hours > notAfterHour) { return; }

	const recUsers = await loadAllUsers(database);
	const outstandingNewsPromises = recUsers.map(recUser => getLatestUnreadArticleForUser(database, recUser));
	const outstandingNewsUsers = await Promise.all(outstandingNewsPromises);
	const recFilteredUsers = filterUsersWithOutstandingNews(outstandingNewsUsers);
	const articleChangesToMake = [];

	// Send message to each user.
	const sendMessagePromises = recFilteredUsers.map(item => {

		const { recUser, recArticle } = item;
		const baseUrl = config.readServer.baseUrl;
		const port = (config.readServer.portInUrl ? `:${config.readServer.port}` : ``);
		const articleId = recArticle._id;
		const feedId = recArticle.feedId;
		const userId = recUser._id;
		const readUrl = `${baseUrl}${port}/${feedId}/${articleId}/${userId}`;
		const message = {
			direction: `outgoing`,
			channelName: recUser.channel.name,
			channelUserId: recUser.channel.userId,
			carousel: {
				sharing: true,
				elements: [{
					label: recArticle.title,
					text: recArticle.description,
					imageUrl: recArticle.imageUrl,
					buttons: [{
						type: `url`,
						label: `Read`,
						payload: readUrl,
						sharing: true,
					}],
				}],
			},
		};

		// Remember the change we need to make to the article documents.
		articleChangesToMake.push({
			recArticle,
			changes: {
				$addToSet: { _receivedByUsers: recUser._id },
			},
		});

		return sendMessage(item.recUser, message);

	});

	await Promise.all(sendMessagePromises);

	// Update all the article documents.
	const updateArticlePromises = articleChangesToMake.map(item =>
		database.update(`Article`, item.recArticle, item.changes)
	);

	await Promise.all(updateArticlePromises);

};
