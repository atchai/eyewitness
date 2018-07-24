'use strict';

/*
 * WORKFLOW: WEBVIEWS
 * Functions for dealing with rendering webviews and accepting form submission from them.
 */

const path = require(`path`);
const querystring = require(`querystring`);
const compileWebviewFunctions = require(`./compileWebview`);

/*
 * Load and cache all the webviews in the top-level webviews directory (not its subdirectories).
 */
async function __loadWebviews (directory) {

	const sharedLogger = this.__dep(`sharedLogger`);

	sharedLogger.debug(`Loading webview layout...`);

	// Load the HTML template.
	this.webviewLayoutHtml = await this.loadFile(path.join(__dirname, `../../server/views/layouts/webview.html`));

	sharedLogger.debug(`Loading default and app webviews...`);

	const defaultWebviewsDirectory = path.join(__dirname, `../../webviews`);
	const defaultWebviews = await this.discoverDirectories(defaultWebviewsDirectory);
	const appWebviews = (directory ? await this.discoverDirectories(directory) : []);
	const allWebviews = defaultWebviews.concat(...appWebviews);

	// Load all of the default webviews in turn.
	for (const webview of allWebviews) {
		const webviewName = webview.replace(new RegExp(`${path.sep}$`), ``).split(path.sep).pop();

		if (this.__getWebview(webviewName)) {
			throw new Error(`A webview with the name "${webviewName}" has already been defined.`);
		}

		this.webviews[webviewName] = {
			webviewName,
			html: await this.loadFile(path.join(webview, `webview.html`), true), // eslint-disable-line no-await-in-loop
			css: await this.loadFile(path.join(webview, `styles.css`), true), // eslint-disable-line no-await-in-loop
			jss: await this.loadFile(path.join(webview, `script.js`), true), // eslint-disable-line no-await-in-loop
			data: await this.parseJsonFile(path.join(webview, `data.json`), true), // eslint-disable-line no-await-in-loop
		};
	}

	sharedLogger.debug(`${defaultWebviews.length} default and ${appWebviews.length} app webviews loaded.`);

}

/*
 * Returns the given webview by its name.
 */
function __getWebview (webviewName) {
	return this.webviews[(webviewName || ``).toLowerCase()] || null;
}

/*
 * Directs any incoming views for webviews to the correct function.
 */
async function handleWebviewRequests (req, res) {

	const database = this.__dep(`database`);
	const { webviewName, flowUri, userId } = this.__matchWebviewUrl(req.url);
	let recUser;

	// Get the matching user record.
	try {
		recUser = await database.get(`User`, { _id: userId });
		if (!recUser) { throw new Error(`Matching user not found.`); }
	}
	catch (err) {
		return res.status(500).respond(err.message, false);
	}

	// Skip if the bot has been disabled for this user.
	if (this.skipIfBotDisabled(`handle webview request`, recUser)) {
		return res.status(500).respond(`Bot disabled or removed.`, false);
	}

	// Attempt to process the request itself.
	try {

		switch (req.method.toLowerCase()) {
			case `get`: return await this.__handleWebviewGet(req, res, recUser, flowUri, webviewName);
			case `post`: return await this.__handleWebviewPost(req, res, recUser, flowUri);
			default: throw new Error(`Method "${req.method}" not supported.`);
		}

	}
	catch (err) {
		return res.status(500).respond(err.message, false);
	}

}

/*
 * Sends the webview page to the client.
 */
function sendWebview (res, output) {

	res.setHeaders({
		'Content-Length': Buffer.byteLength(output),
		'Content-Type': `text/html`,
	});

	res.respond(output, false);

}

/*
 * Render the webview template and send it.
 */
async function __handleWebviewGet (req, res, recUser, flowUri, webviewName) {

	// Check if the user has already moved on from the webview flow.
	if (recUser.conversation.currentStepUri !== flowUri || !recUser.conversation.waitingOnPrompt) {
		throw new Error(`Whoops - I can't show you this again, it looks like the conversation has moved on already.`);
	}

	const flow = this.__getFlow(flowUri);
	const webview = this.__getWebview(webviewName);
	const output = this.compileWebview(webview, flow, recUser);

	this.sendWebview(res, output);

}

/*
 * Handle form submissions from within webviews.
 */
async function __handleWebviewPost (req, res, recUser, flowUri) {

	// Check if the user has already moved on from the webview flow.
	if (recUser.conversation.currentStepUri !== flowUri || !recUser.conversation.waitingOnPrompt) {
		throw new Error(`Whoops - I can't do this again, it looks like the conversation has moved on already.`);
	}

	// Convert the form data in the body to a vanilla JavaScript object.
	const fieldDictionary = querystring.parse(req.body);
	Object.setPrototypeOf(fieldDictionary, Object); // We must restore the prototype after querystring gets its hands on it.

	// Get a reference to the adapter's send message function and then handle the prompt reply.
	const handlePromptPromise = this.handlePromptReply(fieldDictionary, recUser);

	// We should respond before we have handled the prompt reply so the webview can close.
	res.respond({ success: true });

	await handlePromptPromise;

}

/*
 * Spits out the variables from the webview URL as a dictionary.
 */
function __matchWebviewUrl (url) {

	const [ , webviewName, flowUri, userId, adapterName ] =
		url.match(/^\/webview\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)/i) || [];

	return {
		webviewName: (webviewName ? decodeURIComponent(webviewName) : null),
		flowUri: (flowUri ? decodeURIComponent(flowUri) : null),
		userId: (userId ? decodeURIComponent(userId) : null),
		adapterName: (adapterName ? decodeURIComponent(adapterName) : null),
	};

}

/*
 * Returns the base URL of a webview.
 */
function __generateWebviewBaseUrl (webviewName, flowUri, recUser) {

	const baseUrl = this.options.baseUrl;
	const openedFromUri = encodeURIComponent(flowUri);
	const uid = encodeURIComponent(recUser._id);
	const adapterName = encodeURIComponent(recUser.channel.name);

	return `${baseUrl}/webview/${webviewName}/${openedFromUri}/${uid}/${adapterName}`;

}

/*
 * Returns the button definition for the button that opens a webview.
 */
function __getWebviewOpenButtonDefinition (uri, recUser, prompt) {

	return {
		label: prompt.webview.openButton || `Open`,
		type: `url`,
		payload: this.__generateWebviewBaseUrl(prompt.webview.type, uri, recUser),
		sharing: false,
		trusted: true,
	};

}

/*
 * Export.
 */
module.exports = {
	__loadWebviews,
	__getWebview,
	handleWebviewRequests,
	...compileWebviewFunctions,
	sendWebview,
	__handleWebviewGet,
	__handleWebviewPost,
	__matchWebviewUrl,
	__generateWebviewBaseUrl,
	__getWebviewOpenButtonDefinition,
};
