'use strict';

/*
 * HOOK: Feed Ingester
 */

const packageJson = require(`../../package.json`);
const config = require(`config-ninja`).use(`${packageJson.name}-${packageJson.version}-config`);

const crypto = require(`crypto`);
const http = require(`http`);
const https = require(`https`);
const { URL } = require(`url`);
const zlib = require(`zlib`);
const cheerio = require(`cheerio`);
const escapeRegExp = require(`escape-regexp`);
const moment = require(`moment`);
const xml2js = require(`xml2js`);

/*
 * Downloads the given URL, taking into account redirects.
 */
async function downloadUrl (input, numRedirects = 0, rejectOnHttpError = true, sendUA = true) {

	return await new Promise((resolve, reject) => {

		// Don't get stuck in a redirect loop!
		const maxRedirects = 5;

		if (numRedirects > maxRedirects) {
			if (rejectOnHttpError) {
				reject(new Error(`${maxRedirects} redirects are the maximum allowed.`));
				return;
			}
			else {
				resolve(null);
				return;
			}
		}

		// Prepare the module to use.
		const url = new URL(input);
		const httpModule = (url.protocol === `https:` ? https : http);
		const headers = {};

		// Do we need to send the user agent header?
		if (sendUA) {
			headers[`user-agent`] =
				`Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2227.0 Safari/537.36`;
		}

		// Make the request.
		const req = httpModule.get({
			protocol: url.protocol,
			hostname: url.hostname,
			path: url.pathname,
			headers,
		}, res => {

			let stream = res;

			// Decompress request if necessary.
			if (res.headers[`content-encoding`] === `gzip`) {
				stream = zlib.createGunzip();
				res.pipe(stream);
			}

			// Are we redirecting?
			if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
				const redirectPromise = downloadUrl(res.headers.location, numRedirects + 1, rejectOnHttpError, sendUA);
				resolve(redirectPromise);
				return;
			}

			// Cope with server errors.
			if (res.statusCode >= 400) {
				if (rejectOnHttpError) {
					const err = new Error(`Request to "${url.toString()}" failed with a status code of "${res.statusCode}".`);
					reject(err);
					return;
				}
				else {
					resolve(null);
					return;
				}
			}

			let data = ``;

			stream.on(`data`, chunk => data += chunk);
			stream.on(`error`, _err => {

				if (rejectOnHttpError) {
					const err = new Error(`Request to "${url.toString()}" failed because of "${_err}".`);
					reject(err);
					return;
				}

				resolve(null);

			});
			stream.on(`end`, () => resolve(data));

		});

		req.on(`error`, _err => {

			if (rejectOnHttpError) {
				const err = new Error(`Request to "${url.toString()}" failed because of "${_err}".`);
				reject(err);
				return;
			}

			resolve(null);

		});

	});

}

/*
 * Converts the given XML to its JSON representation.
 */
async function parseXml (xml) {

	return await new Promise((resolve, reject) => {
		xml2js.parseString(xml, (err, json) => (err ? reject(err) : resolve(json)));
	});

}

/*
 * Takes the given URL and calculates a hash for it.
 */
function calculateHashFromUrl (_input) {
	const input = _input.trim().toLowerCase();
	return crypto.createHash(`md5`).update(input).digest(`hex`);
}

/*
 * Converts multiple RSS feed item to an Eyewitness article.
 */
async function convertFeedToArticles (variables, feedId, json) {

	const promises = json.rss.channel[0].item.map(item => convertFeedItemToArticle(variables, feedId, item));
	const articles = await Promise.all(promises);
	const uniqueArticles = [];

	articles.forEach(article => {
		const existingArticle = uniqueArticles.find(item => item.articleId === article.articleId);
		if (!existingArticle) { uniqueArticles.push(article); }
	});

	return uniqueArticles;

}

/*
 * Pulls out the date of the article in UTC.
 */
function getFeedItemArticleDate (item, timezoneOffset) {

	const pubDate = item.pubDate[0].replace(/\s[a-z]{2,}$/i, ``);
	const dateFormats = [ `ddd, DD MMM YYYY HH:mm:ss`, `ddd, D MMM YYYY H:m:s` ];
	const articleDate = moment.utc(pubDate, dateFormats).subtract(timezoneOffset, `hours`);

	return articleDate;

}

/*
 * Returns true if the given article is prioritised (i.e. it is breaking news) based on the field (e.g. categories) and
 * the required value of that field (configured on a per-provider basis in the config files).
 */
function getFeedItemIsPriority (item, itemPriorityField, itemPriorityValue) {

	const itemPriorityRegExp = new RegExp(escapeRegExp(itemPriorityValue), `i`);
	const fieldValues = (Array.isArray(item[itemPriorityField]) ? item[itemPriorityField] : [ item[itemPriorityField] ]);
	const matchingValue = fieldValues.find(value => value.match(itemPriorityRegExp));
	const isPriority = Boolean(matchingValue);

	return isPriority;

}

/*
 * Converts a single RSS feed item to an Eyewitness article.
 */
async function convertFeedItemToArticle (variables, feedId, item) {

	// Grab the page as a virtual DOM.
	const articlePageHtml = await downloadUrl(item.link[0], 0, false);
	const timezoneOffset = config.messageVariables.provider.timezoneOffset;
	const itemPriorityField = variables.provider.itemPriorityField;
	const itemPriorityValue = variables.provider.itemPriorityValue;
	let imageUrl = (item.enclosure && item.enclosure[0] && item.enclosure[0].$ ? item.enclosure[0].$.url : ``);
	let title = item.title[0] || null;
	let description = item.description[0] || null;
	let articleDate = moment.utc().add(timezoneOffset, `hours`);
	let isPriority = false;

	// If we have page, try to pull out the rich preview values from the meta tags.
	if (articlePageHtml) {
		const $dom = cheerio.load(articlePageHtml);
		imageUrl = $dom(`head > meta[property="og:image"]`).attr(`content`) || imageUrl || ``;
		title = $dom(`head > meta[property="og:title"]`).attr(`content`) || title || ``;
		description = $dom(`head > meta[property="og:description"]`).attr(`content`) || description || ``;
	}

	// Get the date of the article in a format we can use.
	if (item.pubDate && item.pubDate.length) {
		articleDate = getFeedItemArticleDate(item, timezoneOffset);
	}

	// Check if the item is breaking news.
	if (itemPriorityField && itemPriorityValue && item[itemPriorityField]) {
		isPriority = getFeedItemIsPriority(item, itemPriorityField, itemPriorityValue);
	}

	const articleUrl = item.link[0].trim().toLowerCase();

	return Object({
		feedId,
		articleId: calculateHashFromUrl(articleUrl),
		articleUrl,
		articleDate: articleDate.valueOf(),
		imageUrl: imageUrl.trim(),
		title: title.trim(),
		description: description.trim(),
		isPublished: true,
		isPriority,
	});

}

/*
 * Inserts only the new articles.
 */
async function insertNewArticles (database, feedId, articles) {

	const promises = articles.map(article => {

		const conditions = { feedId, articleId: article.articleId };
		const changes = { $setOnInsert: article };
		const options = { upsert: true, useConditions: true };

		return database.update(`Article`, conditions, changes, options);

	});

	return await Promise.all(promises);

}

/*
 * The hook itself.
 */
module.exports = async function feedIngester (action, variables, { database, sharedLogger }) {

	const rssFeedUrl = variables.provider.rssFeedUrl;
	let xml;

	try {
		xml = await downloadUrl(variables.provider.rssFeedUrl, 0, true, false);
	}
	catch (err) {
		console.error(`Failed to download RSS feed because of "${err}".`); // eslint-disable-line no-console
		return;
	}

	const json = await parseXml(xml);
	const feedId = calculateHashFromUrl(rssFeedUrl);
	const articles = await convertFeedToArticles(variables, feedId, json);

	sharedLogger.verbose(`${articles.length} article(s) ingested from the RSS feed.`, {
		articles,
	});

	await insertNewArticles(database, feedId, articles);

};
