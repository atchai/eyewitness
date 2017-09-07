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
async function downloadUrl (input) {

	return await new Promise((resolve, reject) => {

		const url = new URL(input);
		const httpModule = (url.protocol === `https:` ? https : http);

		httpModule.get(url, res => {

			res.setEncoding(`utf8`);

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
	const promises = json.channel.item.map(item => convertFeedItemToArticle(feedId, item));
	return await Promise.all(promises);
}

/*
 * Converts a single RSS feed item to an Eyewitness article.
 */
async function convertFeedItemToArticle (feedId, item) {

	// Grab the page as a virtual DOM.
	const articlePageHtml = await downloadUrl(item.link);
	const $dom = cheerio.load(articlePageHtml);

	// Pull out the rich preview values from the page.
	const imageUrl = $dom(`head > meta[property="og:image"]`).attr(`content`) || null;
	const title = $dom(`head > meta[property="og:title"]`).attr(`content`) || item.title || null;
	const description = $dom(`head > meta[property="og:description"]`).attr(`content`) || item.description || null;

	return Object({
		feedId,
		articleId: calculateHashFromUrl(item.link),
		articleUrl: item.link,
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

		database.models.Article.update(
			{ feedId, articleId: article.articleId },
			{ $setOnInsert: article },
			{ upsert: true }
		);

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
