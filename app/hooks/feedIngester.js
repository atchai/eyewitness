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
 * Downloads the given URL.
 */
async function downloadUrl (input, numRedirects = 0, rejectOnHttpError = true, sendUA = true) {

	return await new Promise((resolve, reject) => {

		// Don't get stuck in a redirect loop!
		const maxRedirects = 5;

		if (numRedirects > maxRedirects) {
			if (rejectOnHttpError) {
				return reject(new Error(`${maxRedirects} redirects are the maximum allowed.`));
			}
			else {
				return resolve(null);
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
				return resolve(redirectPromise);
			}

			// Cope with server errors.
			if (res.statusCode >= 400) {
				if (rejectOnHttpError) {
					const err = new Error(`Request to "${url.toString()}" failed with a status code of "${res.statusCode}".`);
					return reject(err);
				}
				else {
					return resolve(null);
				}
			}

			let data = ``;

			stream.on(`data`, chunk => data += chunk);
			stream.on(`error`, _err => {

				if (rejectOnHttpError) {
					const err = new Error(`Request to "${url.toString()}" failed because of "${_err}".`);
					return reject(err);
				}

				return resolve(null);

			});
			stream.on(`end`, () => resolve(data));

		});

		req.on(`error`, _err => {

			if (rejectOnHttpError) {
				const err = new Error(`Request to "${url.toString()}" failed because of "${_err}".`);
				return reject(err);
			}

			return resolve(null);

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
	const input = _input.toLowerCase();
	return crypto.createHash(`md5`).update(input).digest(`hex`);
}

/*
 * Converts multiple RSS feed item to an Eyewitness article.
 */
async function convertFeedToArticles (variables, feedId, json) {
	const promises = json.rss.channel[0].item.map(item => convertFeedItemToArticle(variables, feedId, item));
	return await Promise.all(promises);
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
	let imageUrl = item.enclosure && item.enclosure[0].$.url;
	let title = item.title[0] || null;
	let description = item.description[0] || null;
	let articleDate = moment.utc().add(timezoneOffset, `hours`);
	let isPriority = false;

	// Get the date of the article in a format we can use.
	if (item.pubDate && item.pubDate.length) {
		const pubDate = item.pubDate[0].replace(/\s[a-z]{2,}$/i, ``);
		const dateFormats = [`ddd, DD MMM YYYY HH:mm:ss`, `ddd, D MMM YYYY H:m:s`];
		articleDate = moment.utc(pubDate, dateFormats).subtract(timezoneOffset, `hours`);
	}

	// If we have page, try to pull out the rich preview values from the meta tags.
	if (articlePageHtml) {
		const $dom = cheerio.load(articlePageHtml);
		imageUrl = $dom(`head > meta[property="og:image"]`).attr(`content`) || imageUrl;
		title = $dom(`head > meta[property="og:title"]`).attr(`content`) || title;
		description = $dom(`head > meta[property="og:description"]`).attr(`content`) || description;
	}

	// Check if the item is breaking news.
	if (itemPriorityField && itemPriorityValue && item[itemPriorityField]) {
		const itemPriorityRegExp = new RegExp(escapeRegExp(itemPriorityValue), `i`);
		const fieldValues = (Array.isArray(item[itemPriorityField]) ? item[itemPriorityField] : [item[itemPriorityField]]);
		const matchingValue = fieldValues.find(value => value.match(itemPriorityRegExp));

		isPriority = Boolean(matchingValue);
	}

	return Object({
		feedId,
		articleId: calculateHashFromUrl(item.link[0]),
		articleUrl: item.link[0],
		articleDate: articleDate.valueOf(),
		imageUrl,
		title,
		description,
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
module.exports = async function feedIngester (action, variables, { database }) {
	/* eslint no-console: 0 */

	const rssFeedUrl = variables.provider.rssFeedUrl;
	let xml;

	try {
		xml = await downloadUrl(variables.provider.rssFeedUrl, 0, true, false);
	}
	catch (err) {
		return console.error(`Failed to download RSS feed because of "${err}".`);
	}

	const json = await parseXml(xml);
	const feedId = calculateHashFromUrl(rssFeedUrl);
	const articles = await convertFeedToArticles(variables, feedId, json);

	await insertNewArticles(database, feedId, articles);

};
