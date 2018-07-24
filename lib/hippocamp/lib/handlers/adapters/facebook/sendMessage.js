'use strict';

const convertToFacebookMessage = require(`./convertToFacebookMessage`);
const makeRequest = require(`./makeRequest`);

/*
 * Sends a single message within a single request to the Facebook API.
 */
async function sendSingleMessage (recUser, message, resources) {

	const {
		sharedLogger,
		apiUri,
		executeOutgoingMessageMiddleware,
	} = resources;
	const postDataList = [];

	// Run outgoing middleware and start typing.
	await executeOutgoingMessageMiddleware(message, null);

	// Convert the message to the Facebook shape.
	postDataList.push(... await convertToFacebookMessage(recUser.channel.userId, message, resources));

	// Send messages in order.
	const sendMessages = postDataList.reduce(
		(chain, postData) => chain.then(() => makeRequest(apiUri, postData, resources)), // eslint-disable-line promise/prefer-await-to-then
		Promise.resolve()
	);

	// Wait for them all to complete sending.
	try {
		await sendMessages;
	}
	catch (err) {
		sharedLogger.error(`Failed to send a single message via the Facebook API because of "${err}".`);
		sharedLogger.error(err);
	}

}

/*
 * Sends all messages in the queue as a single batch to the Facebook API.
 */
async function sendBatchOfMessages (queue) {

	// Nothing to do if there are no items waiting in the queue.
	if (!queue.length) { return; }

	const resources = queue[0].resources;
	const {
		sharedLogger,
		apiUri,
		executeOutgoingMessageMiddleware,
	} = resources;
	const postDataList = [];

	// Convert messages to Facebook format and run outgoing middleware.
	const conversionPromises = queue.map(async queuedItem => {

		await executeOutgoingMessageMiddleware(queuedItem.message, null);
		const fbMessages = await convertToFacebookMessage(queuedItem.message.channelUserId, queuedItem.message, resources);
		postDataList.push(...fbMessages);

	});

	await Promise.all(conversionPromises);

	// Send messages in one big batch.
	try {
		await makeRequest(apiUri, postDataList, resources);
	}
	catch (err) {
		sharedLogger.error(`Failed to send a batch of messages via the Facebook API because of "${err}".`);
		sharedLogger.error(err);
	}

}

/*
 * Returns true if batching is enabled and the given message is batchable.
 */
function batchingIsAllowed (message, messageBatching) {
	return Boolean(message.batchable && messageBatching.maxQueueSize > 1);
}

/*
 * Returns true if batching is enabled.
 */
function queueIsFull (messageBatching) {
	return Boolean(messageBatching.queue.length >= messageBatching.maxQueueSize);
}

/*
 * Sends all the messages waiting in the queue in the order they were added.
 */
async function flushQueue (messageBatching) {

	// Kill any existing timeout.
	if (messageBatching.timeoutId) {
		clearTimeout(messageBatching.timeoutId);
		messageBatching.timeoutId = null;
	}

	// Send all messages in the queue.
	await sendBatchOfMessages(messageBatching.queue);

	// Empty the queue.
	messageBatching.queue.splice(0);

	// Prepare the next timeout to drain the queue.
	const executeFn = flushQueue.bind(this, messageBatching);
	messageBatching.timeoutId = setTimeout(executeFn, messageBatching.queueFlushIntervalMs);

}

/*
 * Adds a new message to the queue.
 */
async function enqueueMessage (recUser, message, messageBatching, resources) {

	// Flush the existing queue immediately before adding the new message if the queue is already full.
	if (queueIsFull(messageBatching)) {
		await flushQueue(messageBatching);
	}

	// Add new message to queue.
	messageBatching.queue.push({
		channelUserId: recUser.channel.userId,
		queueEntryTime: Date.now(),
		message,
		resources,
	});

}

/*
 * Sends a message immediately or with batching if appropriate.
 */
module.exports = async function sendMessage (recUser, message, messageBatching, resources) {

	// Send message immediately if batching is not allowed for any reason.
	if (!batchingIsAllowed(message, messageBatching)) {
		await sendSingleMessage(recUser, message, resources);
		return;
	}

	// Send message in a batch.
	await enqueueMessage(recUser, message, messageBatching, resources);

};
