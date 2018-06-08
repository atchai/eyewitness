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

	const uiServerUrl = `${config.uiServer.baseUrl}/webhooks/new-message`;

	const req = new RequestNinja(uiServerUrl, {
		timeout: (1000 * 30),
		returnResponseObject: true,
	});

	const res = await req.postJson({
		userId: data.recUser._id.toString(),
		message: data.message,
	});

	if (res.statusCode !== 200) {
		throw new Error(`Non 200 HTTP status code "${res.statusCode}" returned by the Eyewitness UI.`);
	}

	if (!res.body || !res.body.success) { throw new Error(`The Eyewitness UI returned an error: "${res.body.error}".`); }

}

/*
 * Push memory change events to the Eyewitness UI.
 */
async function pushMemoryChangeToUI (data) {

	const uiServerUrl = `${config.uiServer.baseUrl}/webhooks/memory-change`;

	const req = new RequestNinja(uiServerUrl, {
		timeout: (1000 * 30),
		returnResponseObject: true,
	});

	const res = await req.postJson({
		userId: data.recUser._id.toString(),
		memory: data.memory,
	});

	if (res.statusCode !== 200) {
		throw new Error(`Non 200 HTTP status code "${res.statusCode}" returned by the Eyewitness UI.`);
	}

	if (!res.body || !res.body.success) { throw new Error(`The Eyewitness UI returned an error: "${res.body.error}".`); }

}

/*
 * Export.
 */
module.exports = {
	pushNewMessagesToUI,
	pushMemoryChangeToUI,
};
