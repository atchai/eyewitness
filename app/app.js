'use strict';

/*
 * EYEWITNESS CHATBOT
 */

/* eslint no-console: 0 */

// Ensure we always work relative to this script.
process.chdir(__dirname);

const path = require(`path`);
const packageJson = require(`../package.json`);

const providerId = process.env.PROVIDER_ID;
const loadProviderConfig = Boolean(providerId);
const env = process.env.NODE_ENV || `development`;
const localConfigName = path.join(`providers`, providerId, `${providerId}.${env}`);

const config = require(`config-ninja`).init(`${packageJson.name}-${packageJson.version}-config`, `./config`, {
	localConfig: (localConfigName ? [localConfigName] : []),
	requireLocalConfig: loadProviderConfig,
});

const Hippocamp = require(`@atchai/hippocamp`);
const LoggerTerminal = Hippocamp.require(`loggers/terminal`);
const LoggerFilesystem = Hippocamp.require(`loggers/filesystem`);
const DatabaseMongo = Hippocamp.require(`databases/mongo`);
const SchedulerSimple = Hippocamp.require(`schedulers/simple`);
const AdapterFacebook = Hippocamp.require(`adapters/facebook`);

async function main () {

	// A new chatbot!
	const chatbot = new Hippocamp({
		packageJsonPath: `../package.json`,
		baseUrl: config.baseUrl,
		port: config.hippocampServer.port,
		enableUserProfile: false,
		greetingText: config.greetingText,
		menu: config.menu,
		messageVariables: config.messageVariables,
		directories: {
			commands: `./commands`,
			conversation: `./conversation`,
			hooks: `./hooks`,
			models: `./models`,
		},
		debugMode: (config.env.id === `development`),
	});

	// Loggers.
	await chatbot.configure(new LoggerTerminal(config.loggers.terminal));
	if (config.loggers.filesystem) { await chatbot.configure(new LoggerFilesystem(config.loggers.filesystem)); }

	// Databases.
	await chatbot.configure(new DatabaseMongo(config.databases.mongo));

	// Scheduler.
	await chatbot.configure(new SchedulerSimple({
		executeEvery: `minute`,
		tasks: [{
			taskId: `feed-ingester`,
			actions: [{
				type: `execute-hook`,
				hook: `feedIngester`,
			}],
			runEvery: `hour`,
			maxRuns: 0,
		}, {
			taskId: `news-notifications`,
			actions: [{
				type: `execute-hook`,
				hook: `newsNotifications`,
			}],
			runEvery: `hour`,
			maxRuns: 0,
		}],
	}));

	// Adapters.
	await chatbot.configure(new AdapterFacebook(config.adapters.facebook));

	await chatbot.start();

}

/*
 * Run task.
 */
main()
	.catch(err => {
		console.error(err.stack);
		process.exit(1);
	});
