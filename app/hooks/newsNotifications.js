'use strict';

/*
 * HOOK: News Notifications
 */

/*
 * Returns an array of all the user documents.
 */
async function loadAllUsers (database) {
	return await database.models.User.find({}).lean().exec();
}

/*
 * Returns a dictionary containing the latest unread article for the given user, or null.
 */
async function getLatestUnreadArticleForUser (database, recUser) {

	const conditions = {
		_readByUsers: { $nin: [recUser._id] },
	};
	const recArticle = await database.models.Articles.findOne(conditions)
		.sort({ 'articleDate': `desc` })
		.lean()
		.exec();

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

	const recUsers = await loadAllUsers(database);
	const outstandingNewsPromises = recUsers.map(recUser => getLatestUnreadArticleForUser(database, recUser));
	const outstandingNewsUsers = await Promise.all(outstandingNewsPromises);
	const recFilteredUsers = filterUsersWithOutstandingNews(outstandingNewsUsers);


	// Send message to each user.
	const sendMessagePromises = recFilteredUsers.map(item => {

		const { recUser, recArticle } = item;
		const message = {
			direction: `outgoing`,
			channelName: recUser.channel.name,
			channelUserId: recUser.channel.userId,
			
		};

		return sendMessage(item.recUser, message);

	});

	await Promise.all(sendMessagePromises);

};
