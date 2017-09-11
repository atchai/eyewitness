'use strict';

/*
 * HOOK: More News
 */

const packageJson = require(`../../package.json`);
const config = require(`config-ninja`).use(`${packageJson.name}-${packageJson.version}-config`);

/*
 * Returns an array of all the articles the given user has not yet received, sorted newest first.
 */
async function getUnreceivedArticles (database, recUser, limit = 0) {

	const conditions = {
		_receivedByUsers: { $nin: [recUser._id] },
	};
	const options = {
		sort: { articleDate: `desc` },
		limit: limit || null,
	};

	const recArticles = await database.find(`Article`, conditions, options);

	return (limit ? recArticles.slice(0, limit) : recArticles);

}

/*
 * Returns the message stating there are no more news articles to read.
 */
function prepareNoArticlesMessage (MessageObject, recUser) {

	return new MessageObject({
		direction: `outgoing`,
		channelName: recUser.channel.name,
		channelUserId: recUser.channel.userId,
		text: `Whoops! There are no more news articles to read just yet!`,
	});

}

/*
 * Converts the given article into a carousel element.
 */
function prepareArticleElement (variables, recUser, recArticle) {

	const baseUrl = config.readServer.baseUrl;
	const port = (config.readServer.port ? `:${config.readServer.port}` : ``);
	const articleId = recArticle._id;
	const feedId = recArticle.feedId;
	const userId = recUser._id;
	const readUrl = `${baseUrl}${port}/${feedId}/${articleId}/${userId}`;

	return Object({
		label: recArticle.title,
		text: recArticle.description,
		imageUrl: recArticle.imageUrl,
		buttons: [{
			type: `url`,
			label: `Read`,
			payload: readUrl,
			sharing: true,
		}],
	});

}

/*
 * Returns the message containing the prepared carousel element.
 */
function prepareCarouselMessage (MessageObject, variables, recUser, recArticles) {

	return new MessageObject({
		direction: `outgoing`,
		channelName: recUser.channel.name,
		channelUserId: recUser.channel.userId,
		carousel: {
			sharing: true,
			elements: recArticles.map(recArticle => prepareArticleElement(variables, recUser, recArticle)),
		},
	});

}

/*
 * Marks the given articles as received by the given user.
 */
async function markArticlesAsReceived (database, recUser, recArticles) {

	const markPromises = recArticles.map(recArticle =>
		database.update(`Article`, recArticle, { $push: { _receivedByUsers: recUser._id } })
	);

	return await Promise.all(markPromises);

}

/*
 * The hook itself.
 */
module.exports = async function moreNews (action, variables, { database, MessageObject, recUser, sendMessage }) {

	const maxArticles = 5;
	const recArticles = await getUnreceivedArticles(database, recUser, maxArticles);

	// Stop here if we have no articles to send.
	if (!recArticles || !recArticles.length) {
		const noArticlesMessage = prepareNoArticlesMessage(MessageObject, recUser);
		return await sendMessage(recUser, noArticlesMessage);
	}

	// Send the news articles.
	const message = prepareCarouselMessage(MessageObject, variables, recUser, recArticles);
	await sendMessage(recUser, message);

	// Mark articles as recieved by the user.
	await markArticlesAsReceived(database, recUser, recArticles);

};
