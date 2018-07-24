'use strict';

/*
 * WORKFLOW: MODELS
 * Functions for dealing with database models.
 */

const path = require(`path`);

/*
 * Load and all the models in the top-level models directory (not its subdirectories) and add to the database handler.
 */
async function __loadModels (directory, extensionsDirectory) {

	const sharedLogger = this.__dep(`sharedLogger`);
	const database = this.__dep(`database`);

	sharedLogger.debug(`Loading default and app models...`);

	const defaultModelsDirectory = path.join(__dirname, `../models`);
	const defaultModelFiles = await this.discoverFiles(defaultModelsDirectory, `js`, false);
	const appModelFiles = (directory ? await this.discoverFiles(directory, `js`, false) : []);
	const allModelFiles = defaultModelFiles.concat(...appModelFiles);
	const extensionFiles = (extensionsDirectory ? await this.discoverFiles(extensionsDirectory, `js`, false) : []);

	// Load all the model extension files.
	const extensionsMap = {};
	for (const extensionFile of extensionFiles) {
		extensionsMap[this.parseFilename(extensionFile, `js`)] = require(extensionFile); // eslint-disable-line global-require
	}

	// Load all of the model files in turn.
	for (const modelFile of allModelFiles) {
		const Model = require(modelFile); // eslint-disable-line global-require
		const extensionOptions = extensionsMap[this.parseFilename(modelFile, `js`)];
		database.addModel(Model, extensionOptions);
	}

	sharedLogger.debug(`${defaultModelFiles.length} default and ${appModelFiles.length} app models loaded.`);

}

/*
 * Returns only the default models without adding them to the database.
 */
async function getDefaultModelsByKey () {

	const defaultModelsDirectory = path.join(__dirname, `../models`);
	const defaultModelFiles = await this.discoverFiles(defaultModelsDirectory, `js`, false);
	const modelsByKey = [];

	// Load all of the model files in turn.
	for (const modelFile of defaultModelFiles) {
		modelsByKey[this.parseFilename(modelFile, `js`)] = require(modelFile); // eslint-disable-line global-require
	}

	return modelsByKey;

}

/*
 * Returns only the default models without adding them to the database.
 */
async function getDefaultModels () {
	return Object.values(await this.getDefaultModelsByKey());
}

/*
 * Export.
 */
module.exports = {
	__loadModels,
	getDefaultModelsByKey,
	getDefaultModels,
};
