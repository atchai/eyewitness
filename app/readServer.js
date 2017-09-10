'use strict';

/*
 * READ SERVER
 */

/* eslint no-console: 0 */

// Ensure we always work relative to this script.
process.chdir(__dirname);

const packageJson = require(`./../package.json`);
const config = require(`config-ninja`).init(`${packageJson.name}-${packageJson.version}-config`, `./config`);

const http = require(`http`);
const mongoose = require(`mongoose`);
const ArticleModel = require(`./models/article`);

/*
 * Pulls the feed, article and user IDs from the URL.
 * URL format: https://eyewitness.the-amity-gazette.com:5000/{{FEED_ID}}/{{ARTICLE_ID}}/{{USER_ID}}/
 */
function parseIncomingUrl (url) {

	const [ , feedId, articleId, userId ] = url.match(/^\/([a-z0-9]+)\/([a-z0-9]+)\/([a-z0-9]+)\/?$/i) || [];

	return {
		feedId,
		articleId,
		userId,
	};

}

/*
 * Handles incoming requests.
 */
async function handleRequests (req, res) {

	// Pull the IDs from the URL.
	const { feedId, articleId, userId } = parseIncomingUrl(req.url);

	if (!feedId || !articleId || !userId) {
		res.statusCode = 400;
		return res.end(`Invalid URL.`);
	}

	// Check the article exists in the database.
	const docArticle = await ArticleModel.findOne({
		_id: articleId,
		feedId,
	}).exec();

	if (!docArticle) {
		res.statusCode = 404;
		return res.end(`Article not found.`);
	}

	// Mark the article as read by the given user.
	docArticle._readByUsers.push(userId);
	await docArticle.save();

	// Redirect the user to the article URL.
	return res.writeHead(302, { 'Location': docArticle.articleUrl }).end();

}

/*
 * Connects to the Eyewitness chatbot database.
 */
async function connectToDatabase () {

	const connectionString = config.databases.mongo.connectionString;

	return await mongoose.connect(connectionString, {
		useMongoClient: true,
	});

}

/*
 * Boots the read server and starts listening for incoming requests.
 */
async function startReadServer () {

	return await new Promise((resolve, reject) => {

		const port = config.readServer.port;
		const server = http.createServer(handleRequests);

		server.listen(port, err => {

			if (err) {
				console.error(`Failed to start read server on port ${port}.`);
				return reject(err);
			}

			console.log(`Read server running on port ${port}.`);
			return resolve();

		});

	});

}

/*
 * Run task.
 */
Promise.resolve()
	.then(() => {

		// Ensure we always work relative to this script.
		process.chdir(__dirname);

		// Force Mongoose to use native promises.
		mongoose.Promise = global.Promise;

	})
	.then(() => connectToDatabase())
	.then(() => startReadServer())
	.catch(err => {
		console.error(err.stack);
		process.exit(1);
	});
