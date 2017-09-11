'use strict';

/*
 * READ SERVER
 */

/* eslint no-console: 0 */

// Ensure we always work relative to this script.
process.chdir(__dirname);

const path = require(`path`);
const packageJson = require(`../package.json`);

const providerId = process.env.PROVIDER_ID;
const loadProviderConfig = Boolean(providerId);
const env = process.env.NODE_ENV || `development`;
const localConfigName = path.join(`providers`, `${providerId}.${env}`);

const config = require(`config-ninja`).init(`${packageJson.name}-${packageJson.version}-config`, `./config`, {
	localConfig: (localConfigName ? [localConfigName] : []),
	requireLocalConfig: loadProviderConfig,
});

const http = require(`http`);
const Hippocamp = require(`@atchai/hippocamp`);
const DatabaseMongo = Hippocamp.require(`databases/mongo`);
const ArticleModel = require(`./models/article`);

// Instantiate the database.
const database = new DatabaseMongo(config.databases.mongo);
Hippocamp.prepareDependencies(database);
database.addModel(ArticleModel);

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

	// Health check endpoint.
	if (req.url === `/health-check`) {
		res.statusCode = 200;
		return res.end(`OK`);
	}

	// Pull the IDs from the URL.
	const { feedId, articleId, userId } = parseIncomingUrl(req.url);

	if (!feedId || !articleId || !userId) {
		res.statusCode = 400;
		return res.end(`Invalid URL.`);
	}

	// Check the article exists in the database.
	const recArticle = await database.get(`Article`, {
		_id: articleId,
		feedId,
	});

	if (!recArticle) {
		res.statusCode = 404;
		return res.end(`Article not found.`);
	}

	// Mark the article as read by the given user.
	await database.update(`Article`, recArticle, {
		$addToSet: { _readByUsers: userId },
	});

	// Redirect the user to the article URL.
	res.writeHead(302, { 'Location': recArticle.articleUrl });
	res.end();

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
	.then(() => database.connect())
	.then(() => startReadServer())
	.catch(err => {
		console.error(err.stack);
		process.exit(1);
	});
