'use strict';

/*
 * EYEWITNESS CHATBOT
 */

/* eslint no-console: 0 */

const config = require(`./modules/initConfig`);

const Hippocamp = require(`@atchai/hippocamp`); // eslint-disable-line node/no-missing-require
const LoggerTerminal = Hippocamp.require(`loggers/terminal`);
const LoggerFilesystem = Hippocamp.require(`loggers/filesystem`);
const DatabaseMongo = Hippocamp.require(`databases/mongo`);
const SchedulerSimple = Hippocamp.require(`schedulers/simple`);
const AdapterFacebook = Hippocamp.require(`adapters/facebook`);
const AdapterWeb = Hippocamp.require(`adapters/web`);
const AnalyticsDashbot = Hippocamp.require(`analytics/dashbot`);
const AnalyticsSegment = Hippocamp.require(`analytics/segment`);
const NlpLuis = Hippocamp.require(`nlp/luis`);
const { pushNewMessagesToUI, pushMemoryChangeToUI } = require(`./modules/miscellaneous`);

/*
 * The main function.
 */
async function main () {

	// A new chatbot!
	const chatbot = new Hippocamp({
		packageJsonPath: `../package.json`,
		baseUrl: config.hippocampServer.baseUrl,
		port: process.env.PORT || config.hippocampServer.ports.internal,
		enableUserProfile: true,
		enableUserTracking: true,
		enableEventTracking: true,
		enableMessageTracking: true,
		enableNlp: !config.nlp.luis.isDisabled,
		greetingText: config.greetingText,
		misunderstoodText: null,
		menu: [{
			type: `basic`,
			label: `See latest stories`,
			payload: `latest stories`,
		}, {
			type: `nested`,
			label: `Contact us`,
			items: [{
				type: `basic`,
				label: `Send us a story`,
				payload: `do submit story flow`,
			}, {
				type: `basic`,
				label: `Advertise`,
				payload: `do advertise flow`,
			}],
		}, {
			type: `url`,
			label: `Privacy policy`,
			payload: config.privacyPolicyUrl,
			sharing: true,
		}],
		messageVariables: config.messageVariables,
		allowUserTextReplies: true,
		directories: {
			commands: `./commands`,
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
			runEvery: config.scheduledTasks[`feed-ingester`].runEvery,
			maxRuns: 0,
		}, {
			taskId: `news-notifications`,
			actions: [{
				type: `execute-hook`,
				hook: `newsNotifications`,
			}],
			runEvery: config.scheduledTasks[`news-notifications`].runEvery,
			maxRuns: 0,
		}],
	}));

	// Adapters.
	await chatbot.configure(new AdapterFacebook(config.adapters.facebook));
	await chatbot.configure(new AdapterWeb(config.adapters.web));

	// Analytics.
	await chatbot.configure(new AnalyticsDashbot(config.analytics.dashbot));
	await chatbot.configure(new AnalyticsSegment(config.analytics.segment));

	// NLP services.
	if (config.nlp.luis) { chatbot.configure(new NlpLuis(config.nlp.luis)); }

	// Register event listeners.
	chatbot.on(`new-incoming-message`, pushNewMessagesToUI);
	chatbot.on(`new-outgoing-message`, pushNewMessagesToUI);
	chatbot.on(`memory-change`, pushMemoryChangeToUI);

	await chatbot.start();

}

/*
 * Run task.
 */
main()
	.catch(err => { // eslint-disable-line promise/prefer-await-to-callbacks
		console.error(err.stack); // eslint-disable-line no-console
		process.exit(1);
	});
