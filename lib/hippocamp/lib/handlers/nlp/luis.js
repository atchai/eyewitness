'use strict';

/*
 * NLP: LUIS
 */

const extender = require(`object-extender`);
const RequestNinja = require(`request-ninja`);
const NlpBase = require(`./nlpBase`);

module.exports = class NlpLuis extends NlpBase {

	/*
	 * Instantiates the handler.
	 */
	constructor (_options) {

		// Configure the handler.
		super(`nlp`, `luis`);

		// Default config for this handler.
		this.options = extender.defaults({
			appId: null,
			apiKey: null,
			region: `westus`,
			spellCheck: true,
			timezoneOffset: 0,
			isStagingEnv: false,
			isDisabled: false,
		}, _options);

		this.isDisabled = this.options.isDisabled;

		this.endpoint = [
			`https://${this.options.region}.api.cognitive.microsoft.com/luis/v2.0/apps/${this.options.appId}/`,
			`?subscription-key=${this.options.apiKey}&bing-spell-check-subscription-key=${this.options.apiKey}&verbose=true`,
			`&staging=${this.options.isStagingEnv}`,
			`&spellCheck=${this.options.spellCheck}`,
			`&timezoneOffset=${this.options.timezoneOffset}`,
		].join(``);

	}

	/*
	 * Parse some useful information from the given message.
	 */
	async parseMessage (messageText) {

		if (this.checkIfDisabled()) { return null; }

		let data;

		// Make the request to the LUIS service and catch any errors.
		try {
			const req = new RequestNinja(`${this.endpoint}&q=${encodeURIComponent(messageText)}`);
			data = await req.get();

			if (!data || typeof data.query === `undefined`) {
				throw new Error((data && (data.Message || data.error)) ||
					`Unexpected data was returned by LUIS: ${JSON.stringify(data)}`);
			}
		}
		catch (err) {
			throw new Error(`Request to LUIS service failed because of "${err}".`);
		}

		// Convert LUIS data to Hippocamp format.
		return {
			intents: this.convertIntentsToInternalFormat(data.intents),
			entities: this.convertEntitiesToInternalFormat(data.entities),

			// LUIS does not provide this information without adding the MS Text Analytics API.
			language: null,
			sentiment: null,
			keyPhrases: null,
		};

	}

	/*
	 * Converts an array of LUIS intents to our internal intent format.
	 */
	convertIntentsToInternalFormat (luisIntents) {

		const internalIntents = {
			$winner: (luisIntents[0] ? this.convertSingleIntentToInternalFormat(luisIntents[0], 0) : null),
			$order: [],
		};

		luisIntents.forEach((intentObject, index) => {
			const data = this.convertSingleIntentToInternalFormat(intentObject, index);
			internalIntents[data.name] = data;
			internalIntents.$order.push(data.name);
		});

		return internalIntents;

	}

	/*
	 * Converts the LUIS intent format for a single given intent to our internal intent format.
	 */
	convertSingleIntentToInternalFormat (intentObject, index) {
		return {
			name: this.formatObjectName(intentObject.intent),
			$name: intentObject.intent,
			score: this.roundScore(intentObject.score),
			$score: intentObject.score,
			order: index,
		};
	}

	/*
	 * Converts an array of LUIS entities to our internal entity format.
	 */
	convertEntitiesToInternalFormat (luisEntities) {

		const internalEntities = {
			$winner: (luisEntities[0] ? this.convertSingleEntityToInternalFormat(luisEntities[0], 0) : null),
			$order: [],
		};

		luisEntities.forEach((entityObject, index) => {
			const data = this.convertSingleEntityToInternalFormat(entityObject, index);
			internalEntities[data.name] = data;
			internalEntities.$order.push(data.name);
		});

		return internalEntities;

	}

	/*
	 * Converts the LUIS entity format for a single given entity to our internal entity format.
	 */
	convertSingleEntityToInternalFormat (entityObject, index) {
		return {
			name: this.formatObjectName(entityObject.type),
			$name: entityObject.type,
			score: this.roundScore(entityObject.score),
			$score: entityObject.score,
			matchedText: entityObject.entity,
			startIndex: entityObject.startIndex,
			endIndex: entityObject.endIndex,
			order: index,
		};
	}

};
