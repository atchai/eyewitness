'use strict';

/*
 * HOOK: Feed Ingester
 */

const crypto = require(`crypto`);
const http = require(`http`);
const https = require(`https`);
const { URL } = require(`url`);
const cheerio = require(`cheerio`);
const xml2js = require(`xml2js`);

/*
 * Downloads the given URL.
 */
async function downloadUrl (input, numRedirects = 0) {

	return await new Promise((resolve, reject) => {

		const maxRedirects = 5;
		if (numRedirects > maxRedirects) { return reject(new Error(`${maxRedirects} redirects are the maximum allowed.`)); }

		const url = new URL(input);
		const httpModule = (url.protocol === `https:` ? https : http);

		httpModule.get(url, res => {

			res.setEncoding(`utf8`);

			// Are we redirecting?
			if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
				const redirectPromise = downloadUrl(res.headers.location, numRedirects + 1);
				return resolve(redirectPromise);
			}

			// Cope with server errors.
			if (res.statusCode >= 400) {
				return reject(new Error(`Server returned error status code of "${res.statusCode}".`));
			}

			let data = ``;

			res.on(`data`, chunk => data += chunk);
			res.on(`error`, err => reject(err));
			res.on(`end`, () => resolve(data));

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
async function convertFeedToArticles (feedId, json) {
	const promises = json.rss.channel[0].item.map(item => convertFeedItemToArticle(feedId, item));
	return await Promise.all(promises);
}

/*
 * Converts a single RSS feed item to an Eyewitness article.
 */
async function convertFeedItemToArticle (feedId, item) {

	// Grab the page as a virtual DOM.
	const articlePageHtml = await downloadUrl(item.link[0]);
	const $dom = cheerio.load(articlePageHtml);

	// Pull out the rich preview values from the page.
	const imageUrl = $dom(`head > meta[property="og:image"]`).attr(`content`) || null;
	const title = $dom(`head > meta[property="og:title"]`).attr(`content`) || item.title[0] || null;
	const description = $dom(`head > meta[property="og:description"]`).attr(`content`) || item.description[0] || null;

	return Object({
		feedId,
		articleId: calculateHashFromUrl(item.link[0]),
		articleUrl: item.link[0],
		imageUrl,
		title,
		description,
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

	const rssFeedUrl = variables.provider.rssFeedUrl;
	const xml = await downloadUrl(variables.provider.rssFeedUrl);
	const json = await parseXml(xml);
	const feedId = calculateHashFromUrl(rssFeedUrl);
	const articles = await convertFeedToArticles(feedId, json);

	await insertNewArticles(database, feedId, articles);

};
