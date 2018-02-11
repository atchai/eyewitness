'use strict';

/*
 * READ SERVER
 */

/* eslint no-console: 0 */

const path = require(`path`);
const packageJson = require(`../package.json`);

const providerId = process.env.PROVIDER_ID;
const loadProviderConfig = Boolean(providerId);
const env = process.env.NODE_ENV || `development`;
const localConfigName = path.join(`providers`, `${providerId}.${env}`);

const config = require(`config-ninja`).init(`${packageJson.name}-${packageJson.version}-config`, `./config`, {
	localConfig: (localConfigName ? [ localConfigName ] : []),
	requireLocalConfig: loadProviderConfig,
});

const http = require(`http`);
const Hippocamp = require(`@atchai/hippocamp`);
const DatabaseMongo = Hippocamp.require(`databases/mongo`);
const AnalyticsSegment = Hippocamp.require(`analytics/segment`);
const ArticleModel = require(`./models/article`);
const UserModel = require(`@atchai/hippocamp/lib/models/user`);

// Instantiate the database.
const database = new DatabaseMongo(config.databases.mongo);
Hippocamp.prepareDependencies(database);
database.addModel(ArticleModel);
database.addModel(UserModel);

// Initialise Segment.
const analytics = new AnalyticsSegment(config.analytics.segment);

/*
 * Pulls the feed, article and user IDs from the URL.
 * URL format: https://eyewitness.the-amity-gazette.com:5000/{{FEED_ID}}/{{ARTICLE_ID}}/{{USER_ID}}/
 */
function parseIncomingUrl (url) {

	const [ , feedId, articleId, userId, noTrackStr ] =
		url.match(/^\/([a-z0-9]+)\/([a-z0-9]+)\/([a-z0-9]+)\/?(?:\?(notrack(?:\=\d)?))?$/i) || [];

	return {
		feedId,
		articleId,
		userId,
		noTrack: Boolean(noTrackStr === `notrack=1` || noTrackStr === `notrack`),
	};

}

/*
 * Handles requests to the health check endpoint.
 */
function handleHealthCheckRoute (res) {

	const body = `{"healthy":true}`;

	res.writeHead(200, {
		'Content-Length': Buffer.byteLength(body),
		'Content-Type': `application/json`,
	});

	res.end(body);

}

/*
 * Sends an error response to the client.
 */
function sendErrorResponse (res, statusCode = 400, message = `An unknown error occured.`) {
	res.statusCode = statusCode;
	res.end(message);
}

/*
 * Handles incoming requests.
 */
async function handleRequests (req, res) {

	if (req.url === `/health-check`) {
		handleHealthCheckRoute(res);
		return;
	}

	// Pull the IDs from the URL.
	const { feedId, articleId, userId, noTrack } = parseIncomingUrl(req.url);

	if (!feedId || !articleId || !userId) {
		sendErrorResponse(res, 400, `Invalid URL.`);
		return;
	}

	// Check the user exists in the database.
	const recUser = await database.get(`User`, {
		_id: userId,
	});

	if (!recUser) {
		sendErrorResponse(res, 404, `User not found.`);
		return;
	}

	// Check the article exists in the database.
	const recArticle = await database.get(`Article`, {
		_id: articleId,
		feedId,
	});

	if (!recArticle) {
		sendErrorResponse(res, 404, `Article not found.`);
		return;
	}

	// We are allowed to track.
	if (!noTrack) {

		// Mark the article as read by the given user.
		await database.update(`Article`, recArticle, {
			$addToSet: { _readByUsers: recUser._id },
		});

		analytics.trackEvent(recUser, `read-article`, {
			articleId: recArticle._id.toString(),
		});

	}

	// Redirect the user to the article URL.
	res.writeHead(302, { 'Location': recArticle.articleUrl });
	res.end();

}

/*
 * Boots the read server and starts listening for incoming requests.
 */
async function startReadServer () {

	return await new Promise((resolve, reject) => {

		const port = process.env.PORT || config.readServer.ports.internal;
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
	.then(() => database.connect()) // eslint-disable-line promise/prefer-await-to-then
	.then(() => startReadServer()) // eslint-disable-line promise/prefer-await-to-then
	.catch(err => { // eslint-disable-line promise/prefer-await-to-callbacks
		console.error(err.stack);
		process.exit(1);
	});
