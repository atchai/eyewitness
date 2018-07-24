'use strict';

/*
 * HOOK: $flowinfo
 */

/* eslint no-cond-assign: 0 */

module.exports = async function flowinfo (action, variables, { MessageObject, recUser, sendMessage, flows }) {

	// General user info.
	await sendMessage(recUser, MessageObject.outgoing(recUser, {
		text: [
			`Previous Flow URI: ${recUser.conversation.previousStepUri}`,
			`Current Flow URI: ${recUser.conversation.currentStepUri}`,
		].join(`\n`),
	}));

	await sendMessage(recUser, MessageObject.outgoing(recUser, {
		text: [
			`Available Flows:`,
			...Object.values(flows).map(flow => `${flow.uri} (${flow.dynamicId || flow.filename})`),
		].join(`\n`),
	}));

};
