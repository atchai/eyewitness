'use strict';

const htmlMinifier = require(`html-minifier`);
const extender = require(`object-extender`);
const utilities = require(`../../modules/utilities`);

/*
 * Merge together all the sources of data.
 */
function createWebviewVariables (recUser, webview, flow) {

	const cancelButton = flow.definition.prompt.webview.cancelButton;
	const cancelButtonText = (typeof cancelButton === `undefined` ? `Cancel` : cancelButton);

	return extender.merge(
		this.options.messageVariables,
		webview.data,
		flow.definition.prompt.webview.data,
		recUser.profile,
		recUser.appData,
		{
			webviewBaseUrl: this.__generateWebviewBaseUrl(webview.webviewName, flow.uri, recUser),
			webviewCss: webview.css,
			webviewJs: webview.jss,
			styleName: flow.definition.prompt.webview.style || `default`,
			title: flow.definition.prompt.webview.title || `Webview`,
			instructions: flow.definition.prompt.webview.instructions || flow.definition.prompt.text,
			cancelButton: cancelButtonText,
			submitButton: flow.definition.prompt.webview.submitButton || `Save & Close`,
		}
	);

}

/*
 * Compile the templates for the other values used in the webview.
 */
function compileVariableTemplates (templateVariables) {

	templateVariables.title = utilities.compileTemplate(templateVariables.title, templateVariables);
	templateVariables.instructions = utilities.compileTemplate(templateVariables.instructions, templateVariables);
	templateVariables.cancelButton = utilities.compileTemplate(templateVariables.cancelButton, templateVariables);
	templateVariables.submitButton = utilities.compileTemplate(templateVariables.submitButton, templateVariables);

}

/*
 * If there are any references in the variables (e.g. "<someOtherVar>") then replace with the correct values.
 */
function evaluateReferencesInVariables (templateVariables) {

	for (const key in templateVariables) {
		if (!templateVariables.hasOwnProperty(key)) { continue; }

		const string = templateVariables[key];
		const evalResult = this.evaluateReferencedVariables(string, templateVariables, false);

		if (evalResult) { templateVariables[key] = evalResult.output; }
	}

}

/*
 * Compiles the webview template.
 */
function compileWebview (webview, flow, recUser) {

	// Prepare template variables.
	const templateVariables = this.createWebviewVariables(recUser, webview, flow);
	this.compileVariableTemplates(templateVariables);
	this.evaluateReferencesInVariables(templateVariables);

	// Compile the webview itself.
	templateVariables.webviewHtml = utilities.compileTemplate(webview.html, templateVariables);
	const html = utilities.compileTemplate(this.webviewLayoutHtml, templateVariables);

	// Minify the output.
	const output = htmlMinifier.minify(html, {
		collapseBooleanAttributes: true,
		collapseInlineTagWhitespace: true,
		collapseWhitespace: true,
		maxLineLength: 500,
		minifyCSS: true,
		minifyJS: true,
		removeAttributeQuotes: true,
		removeComments: true,
		removeEmptyAttributes: true,
		removeRedundantAttributes: true,
		removeScriptTypeAttributes: true,
		removeStyleLinkTypeAttributes: true,
	});

	return output;

}

/*
 * Export.
 */
module.exports = {
	createWebviewVariables,
	compileVariableTemplates,
	evaluateReferencesInVariables,
	compileWebview,
};
