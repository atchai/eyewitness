'use strict';

const config = require(`config-ninja`).use(`eyewitness-bot-config`);

const BATCH_SIZE_ENQUEUE = 1000;
const BATCH_SIZE_SEND = 500;
const BATCH_DELAY_MS = 2000;
const READ_SERVER_BASE_URL = config.readServer.baseUrl;
const QUEUE_COLLECTION = `BreakingNewsQueuedItem`;
const ARTICLE_COLLECTION = `Article`;

/*
 * Returns the next batch of queued breaking news items, or an empty array if there are none.
 */
async function getBatchOfQueuedItems (database, skip = 0, limit = 1) {

	const recQueueItems = await database.find(QUEUE_COLLECTION, {
		numTries: { $lt: config.breakingNews.maxTries },
	}, {
		sort: { addedDate: `asc` },
		skip,
		limit,
	});

	return recQueueItems || [];

}

/*
 * Returns the breaking news messages we need to send to the user.
 */
function constructBreakingNewsMessages (recUser, recArticleCompact, MessageObject) {

	const alertMessage = MessageObject.outgoing(recUser, {
		text: `Breaking news!`,
	});

	const carouselMessage = MessageObject.outgoing(recUser, {
		carousel: {
			sharing: true,
			elements: [{
				label: recArticleCompact.title,
				text: recArticleCompact.description,
				imageUrl: recArticleCompact.imageUrl,
				buttons: [{
					type: `url`,
					label: `Read`,
					payload: `${READ_SERVER_BASE_URL}/${recArticleCompact.feedId}/${recArticleCompact._id}/${recUser._id}`,
					sharing: true,
				}],
			}],
		},
		options: [{
			label: `More stories`,
		}, {
			label: `Main menu`,
		}, {
			label: `Unsubscribe`,
		}],
	});

	return {
		alertMessage,
		carouselMessage,
	};

}

/*
 * Sends all the queued items recursively.
 */
async function sendQueuedItems (database, sharedLogger, MessageObject, sendMessage, skip = 0) {

	const batchSize = BATCH_SIZE_SEND;

	// Get the next batch of items.
	const recQueueItems = await getBatchOfQueuedItems(database, skip, batchSize);
	if (!recQueueItems.length) { return; }

	// Send each queued item in turn to their respective users.
	const sendPromises = recQueueItems.map(async recQueueItem => {

		const { _id: itemId, userData, articleData } = recQueueItem;
		const { alertMessage, carouselMessage } = constructBreakingNewsMessages(userData, articleData, MessageObject);

		sharedLogger.silly(`### USER <${userData._id}> ARTICLE <${articleData._id}> <${articleData.title}>`);

		// Send the messages.
		try {
			await sendMessage(userData, alertMessage);
			await sendMessage(userData, carouselMessage);
		}
		catch (err) {
			sharedLogger.error(`Failed to send breaking news message to user "${userData._id}" because of "${err}".`);

			await database.update(QUEUE_COLLECTION, recQueueItem._id, {
				$inc: { numTries: 1 },
			});

			// Skip to next queued item.
			return;
		}

		// Mark as received by user.
		await database.update(ARTICLE_COLLECTION, articleData._id, {
			$addToSet: { _receivedByUsers: userData._id },
		});

		await database.delete(QUEUE_COLLECTION, itemId);

	});

	await Promise.all(sendPromises);

	// Send the next batch of items recursively AND without creating a huge function stack.
	const numCompletedItems = skip + batchSize;
	const fnRecurse = sendQueuedItems.bind(this, database, sharedLogger, MessageObject, sendMessage, numCompletedItems);

	setTimeout(fnRecurse, BATCH_DELAY_MS);

}

/*
 * Returns the next batch of users, or an empty array if there are none.
 */
async function getBatchOfUsers (database, skip = 0, limit = 1) {

	const recUsers = await database.find(`User`, {
		'bot.disabled': { $ne: true },
		'appData.unsubscribed': { $ne: true },
	}, {
		sort: { _id: `asc` }, // Keep the entire result set in a consistent order between queries.
		skip,
		limit,
	});

	return recUsers || [];

}

/*
 * Returns the next unread breaking news story for the given user.
 */
async function getNextBreakingNewsForUser (database, recUser) {

	const conditions = {
		_receivedByUsers: { $nin: [ recUser._id ] },
		articleDate: { $gt: recUser.profile.created },
		isPublished: { $ne: false },
		isPriority: true,
	};
	const options = {
		sort: { articleDate: `asc` },
	};

	const recArticle = await database.get(ARTICLE_COLLECTION, conditions, options);
	if (!recArticle) { return null; }

	// Reduce memory usage.
	const recArticleCompact = {
		_id: recArticle._id,
		feedId: recArticle.feedId,
		title: recArticle.title,
		description: recArticle.description,
		imageUrl: recArticle.imageUrl,
	};

	return recArticleCompact;

}

/*
 * Queues all the breaking news articles for all the users that need to be sent out.
 */
async function queueBreakingNewsItems (database, skip = 0) {

	const batchSize = BATCH_SIZE_ENQUEUE;

	// Get the next batch of users.
	const recUsers = await getBatchOfUsers(database, skip, batchSize);
	if (!recUsers.length) { return; }

	// Iterate over each user in turn and queue their unread breaking news.
	for (const recUser of recUsers) {
		const recArticleCompact = await getNextBreakingNewsForUser(database, recUser); // eslint-disable-line no-await-in-loop

		if (!recArticleCompact) { continue; }

		await database.insert(QUEUE_COLLECTION, { // eslint-disable-line no-await-in-loop
			userData: recUser,
			articleData: recArticleCompact,
		});
	}

	// Queue the next batch of users recursively AND without creating a huge function stack.
	const numCompletedUsers = skip + batchSize;
	const fnRecurse = queueBreakingNewsItems.bind(this, database, numCompletedUsers);

	setTimeout(fnRecurse, BATCH_DELAY_MS);

}

/*
 * Sends the most recent outstanding breaking news stories to users.
 */
async function sendOutstanding (database, sharedLogger, MessageObject, sendMessage) {

	// Send out any breaking news stories still in the queue (in case of restart).
	await sendQueuedItems(database, sharedLogger, MessageObject, sendMessage);

	// Queue the next batch of breaking news stories to send out.
	await queueBreakingNewsItems(database);

	// Send out the next batch of breaking news stories.
	await sendQueuedItems(database, sharedLogger, MessageObject, sendMessage);

}

/*
 * Export.
 */
module.exports = {
	sendOutstanding,
};
