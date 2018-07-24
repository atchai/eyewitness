'use strict';

/*
 * INITIALISE CONFIG
 */

const path = require(`path`);

const config = require(`config-ninja`).init(`eyewitness-bot-config`, `./config`, {
	environmentVariables: {
		enableDotenv: (process.env.NODE_ENV === `development`),
		dotenvPath: path.join(__dirname, `..`, `..`, `.env`),
		mapping: {
			LOGGERS_TERMINAL_LEVEL: `loggers.terminal.logLevel`,
			DB_MONGO_CONNECTION_STR: `databases.mongo.connectionString`,
			ANALYTICS_DASHBOT_API_KEY: `analytics.dashbot.apiKey`,
			ANALYTICS_SEGMENT_WRITE_KEY: `analytics.segment.writeKey`,
			ADAPTER_FB_VERIFY_TOKEN: `adapters.facebook.verifyToken`,
			ADAPTER_FB_ACCESS_TOKEN: `adapters.facebook.accessToken`,
			NLP_LUIS_DISABLED: `nlp.luis.isDisabled`,
			NLP_LUIS_APP_ID: `nlp.luis.appId`,
			NLP_LUIS_API_KEY: `nlp.luis.apiKey`,
			NLP_LUIS_APP_REGION: `nlp.luis.region`,
			SERVER_URI_BOT: `hippocampServer.baseUrl`,
			SERVER_URI_READ: `readServer.baseUrl`,
			SERVER_URI_UI: `uiServer.baseUrl`,
			PROVIDER_NAME: `messageVariables.provider.name`,
			PROVIDER_FEED_URI: `messageVariables.provider.rssFeedUrl`,
			PROVIDER_TIMEZONE_OFFSET: `messageVariables.provider.timezoneOffset`,
			PROVIDER_ITEM_PRIORITY_FIELD: `messageVariables.provider.itemPriorityField`,
			PROVIDER_ITEM_PRIORITY_VALUE: `messageVariables.provider.itemPriorityValue`,
			GREETING_TEXT: `greetingText`,
			PRIVACY_POLICY_URI: `privacyPolicyUrl`,
		},
	},
});

/*
 * EXPORT
 */
module.exports = config;
