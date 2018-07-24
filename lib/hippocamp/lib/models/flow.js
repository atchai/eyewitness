'use strict';

const shortid = require(`shortid`);

/*
 * SCHEMA: Flow
 */

module.exports = function (Schema, Property) {

	/*
	 * Miscellaneous.
	 */

	const schUiMetaConditional = new Schema(`FlowUiMetaConditional`, {
		matchType: new Property(`string`, `memory-key`),
		memoryKey: new Property(`string`),
		operator: new Property(`string`), // set, not-set, equals, not-equals, contains, notify-admin, starts-with, ends-with, expression
		value: new Property(`string`),
		expression: new Property(`string`),
	});

	/*
	 * Actions.
	 */

	const schFlowAction = new Schema(`FlowAction`, {
		shortId: new Property(`string`, shortid.generate), // TODO: unique: true
		type: new Property(`string`),
		conditional: new Property(`string`, ``),
		nextUri: new Property(`string`),
		message: new Property(`flexible`),
		delay: new Property(`integer`),
		markAsTyping: new Property(`boolean`),
		hook: new Property(`string`),
		wipeProfile: new Property(`boolean`),
		wipeMessages: new Property(`boolean`),
		state: new Property(`boolean`),
		memory: new Property(`flexible`),
		event: {
			name: new Property(`string`),
			data: new Property(`flexible`),
		},
		traits: new Property(`flexible`),
		task: {
			taskId: new Property(`string`),
			nextRunDate: new Property(`date`),
			runEvery: new Property(`string`),
			runTime: new Property(`string`),
			maxRuns: new Property(`integer`),
			ignoreDays: [ new Property(`string`) ],
			allowConcurrent: new Property(`boolean`),
			actions: [ new Property(`flexible`) ],
		},
		errorMessage: new Property(`string`),
		uiMeta: {
			stepType: new Property(`string`),
			conditional: schUiMetaConditional,
			returnAfterLoadFlow: new Property(`boolean`, false),
		},
	});

	/*
	 * Prompts.
	 */

	const schPromptText = new Schema(`FlowPromptText`, {
		conditional: new Property(`string`, ``),
		value: new Property(`string`),
		uiMeta: {
			conditional: schUiMetaConditional,
		},
	});

	const schFlowOption = new Schema(`FlowOption`, {
		conditional: new Property(`string`, ``),
		label: new Property(`string`),
		payload: new Property(`string`),
		matches: new Property(`flexible`),
		nextUri: new Property(`string`),
		uiMeta: {
			conditional: schUiMetaConditional,
			actionType: new Property(`string`),
		},
	});

	const schFlowPrompt = new Schema(`FlowPrompt`, {
		type: new Property(`string`, `basic`),
		text: [ schPromptText ],
		options: [ schFlowOption ],
		memory: new Property(`flexible`),
		webview: {
			type: new Property(`string`, `basic`),
			style: new Property(`string`, `default`),
			title: new Property(`string`),
			instructions: new Property(`string`),
			openButton: new Property(`string`),
			cancelButton: new Property(`string`),
			submitButton: new Property(`string`),
			data: new Property(`flexible`),
		},
		trackResponse: {
			eventName: new Property(`string`),
			fieldName: new Property(`string`),
		},
		nextUri: new Property(`string`),
		errorMessage: new Property(`string`),
		uiMeta: {
			answerType: new Property(`string`),
		},
	});

	/*
	 * Flows.
	 */

	return new Schema(`Flow`, {
		uri: new Property(`string`, null), // Optional for dynamic flows.
		name: new Property(`string`),
		type: new Property(`string`, `basic`),
		nextUri: new Property(`string`, null),
		actions: [ schFlowAction ],
		prompt: schFlowPrompt,
		interruptions: {
			whenAgent: new Property(`string`, `ask-user`),
			whenSubject: new Property(`string`, `ask-user`),
		},
		uiMeta: {

		},
		created: new Property(`date`, Date.now),
		updated: new Property(`date`, Date.now),
	});

};
