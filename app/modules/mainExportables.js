'use strict';

/*
 * MAIN EXPORTABLES
 * Functions that get exported by the main app entrypoint module.
 */

/* eslint-disable global-require */

const Hippocamp = require(`@atchai/hippocamp`);
const ArticleModel = require(`../models/article`);
const GlobalSettingsModel = require(`../models/globalSettings`);

/*
 * Returns the Eyewitness config.
 */
function getEyewitnessConfig () {
	const config = require(`./initConfig`);
	return config;
}

/*
 * Allows the caller to connect to the database.
 */
async function connectToEyewitnessDatabase (providerId) {

	// Grab our dependencies.
	const config = getEyewitnessConfig(providerId);
	const DatabaseMongo = Hippocamp.require(`databases/mongo`);

	// Instantiate the database.
	const database = new DatabaseMongo(config.databases.mongo);
	Hippocamp.prepareDependencies(database);

	const defaultModels = await Hippocamp.getDefaultModels();
	defaultModels.forEach(model => database.addModel(model));
	database.addModel(ArticleModel);
	database.addModel(GlobalSettingsModel);

	await database.connect();

	return database;

}

/*
 * Export.
 */
module.exports = {
	getEyewitnessConfig,
	connectToEyewitnessDatabase,
};
