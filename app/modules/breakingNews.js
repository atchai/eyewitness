'use strict';

const packageJson = require(`../../package.json`);
const config = require(`config-ninja`).use(`${packageJson.name}-${packageJson.version}-config`);

/*
 * Returns an array of all the user documents.
 */
async function loadAllUsers (database) {
	return await database.find(`User`, {});
}

/*
 * Returns a dictionary containing the latest unread story record and the user record for the given user, or null.
 */
async function getLatestUnreadPriorityArticleForUser (database, recUser) {

	const conditions = {
		_receivedByUsers: { $nin: [ recUser._id ] },
		articleDate: { $gt: recUser.profile.created },
		isPublished: { $ne: false },
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
 * Returns an array of users who have outstanding news (i.e. at least 1 unread story).
 */
function filterUsersWithOutstandingNews (outstandingNewsUsers) {
	return outstandingNewsUsers.filter(outstandingNewsUser => Boolean(outstandingNewsUser));
}

/*
 * Sends the most recent outstanding breaking news stories to users.
 */
async function sendOutstanding (database, MessageObject, sendMessage) {

	const recUsers = await loadAllUsers(database);
	const outstandingNewsPromises = recUsers.map(recUser => getLatestUnreadPriorityArticleForUser(database, recUser));
	const outstandingNewsUsers = await Promise.all(outstandingNewsPromises);
	const recFilteredUsers = filterUsersWithOutstandingNews(outstandingNewsUsers);

	// Send message to each user.
	const sendMessagePromises = recFilteredUsers.map(async item => {

		const { recUser, recArticle } = item;
		const baseUrl = config.readServer.baseUrl;
		const articleId = recArticle._id;
		const feedId = recArticle.feedId;
		const userId = recUser._id;
		const readUrl = `${baseUrl}/${feedId}/${articleId}/${userId}`;

		const alertMessage = MessageObject.outgoing(recUser, {
			text: `Breaking news!`,
		});

		const carouselMessage = MessageObject.outgoing(recUser, {
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
			options: [{
				label: `More stories`,
			}, {
				label: `Main menu`,
			}],
		});

		await sendMessage(recUser, alertMessage);
		await sendMessage(recUser, carouselMessage);

		await database.update(`Article`, recArticle, {
			$addToSet: { _receivedByUsers: recUser._id },
		});

	});

	await Promise.all(sendMessagePromises);

}

/*
 * Export.
 */
module.exports = {
	sendOutstanding,
};
