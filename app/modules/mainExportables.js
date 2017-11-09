'use strict';

/*
 * MAIN EXPORTABLES
 * Functions that get exported by the main app entrypoint module.
 */

/* eslint-disable global-require */

const path = require(`path`);
const Hippocamp = require(`@atchai/hippocamp`);
const ArticleModel = require(`../models/article`);

/*
 * Returns the Eyewitness config for the given provider.
 */
function getEyewitnessConfig () {

	const providerId = process.env.PROVIDER_ID;
	const loadProviderConfig = Boolean(providerId);
	const env = process.env.NODE_ENV || `development`;
	const localConfigName = path.join(`providers`, `${providerId}.${env}`);

	const config = require(`config-ninja`).init(`${providerId}-exportable-config`, `./config`, {
		localConfig: (localConfigName ? [localConfigName] : []),
		requireLocalConfig: loadProviderConfig,
	});

	return config;

}

/*
 * Allows the caller to connect to the given provider's database.
 */
async function connectToEyewitnessDatabase (providerId) {

	// Grab our dependencies.
	const config = getEyewitnessConfig(providerId);
	const DatabaseMongo = Hippocamp.require(`databases/mongo`);

	// Instantiate the database.
	const database = new DatabaseMongo(config.databases.mongo);
	Hippocamp.prepareDependencies(database);
	database.addModel(ArticleModel);

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
