'use strict';
/*
 * MISCELLANEOUS
 */

const packageJson = require(`../../package.json`);

const config = require(`config-ninja`).use(`${packageJson.name}-${packageJson.version}-config`);

const RequestNinja = require(`request-ninja`);

/*
 * Push new incoming and outgoing messages to the Eyewitness UI.
 */
async function pushNewMessagesToUI (data) {

	const uiServerUrl = config.uiServer.baseUrl;
	const req = new RequestNinja(uiServerUrl, {
		timeout: (1000 * 30),
		returnResponseObject: true,
	});

	const res = await req.postJson(data);

	if (res.statusCode) { throw new Error(`Non 200 HTTP status code returned by the Eyewitness UI.`); }
	if (!res.body.success) { throw new Error(`The Eyewitness UI returned an error: "${res.body.error}".`); }

}

/*
 * Export.
 */
module.exports = {
	pushNewMessagesToUI,
};
