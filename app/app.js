'use strict';

/*
 * EYEWITNESS CHATBOT
 */

// Ensure we always work relative to this script.
process.chdir(__dirname);

const packageJson = require(`../package.json`);
const localConfigName = `${process.env.PROVIDER_ID}.${process.env.NODE_ENV || `development`}`;
const config = require(`config-ninja`).init(`${packageJson.name}-${packageJson.version}-config`, `./config`, {
	localConfig: [localConfigName],
	requireLocalConfig: true,
});

const Hippocamp = require(`@atchai/hippocamp`);
const LoggerTerminal = Hippocamp.require(`loggers/terminal`);
const LoggerFilesystem = Hippocamp.require(`loggers/filesystem`);
const DatabaseMongo = Hippocamp.require(`databases/mongo`);
const SchedulerSimple = Hippocamp.require(`schedulers/simple`);
const AdapterFacebook = Hippocamp.require(`adapters/facebook`);

// A new chatbot!
const chatbot = new Hippocamp({
	packageJsonPath: `../package.json`,
	baseUrl: config.baseUrl,
	port: 5000,
	enableUserProfile: false,
	greetingText: config.greetingText,
	menu: config.menu,
	messageVariables: config.messageVariables,
	directories: {
		conversation: `./conversation`,
		hooks: `./hooks`,
	},
	debugMode: (config.env.id === `development`),
});

// Loggers.
chatbot.configure(new LoggerTerminal(config.loggers.terminal));
if (config.loggers.filesystem) { chatbot.configure(new LoggerFilesystem(config.loggers.filesystem)); }

// Databases.
chatbot.configure(new DatabaseMongo(config.databases.mongo));

// Scheduler.
chatbot.configure(new SchedulerSimple({
	executeEvery: `minute`,
	tasks: [{
		actions: [{
			type: `execute-hook`,
			hook: `feedIngester`,
		}],
		runEvery: `hour`,
	}, {
		actions: [{
			type: `execute-hook`,
			hook: `newsNotifications`,
		}],
		runEvery: `hour`,
	}],
}));

// Adapters.
chatbot.configure(new AdapterFacebook(config.adapters.facebook));

chatbot.start();
