'use strict';

const utilities = require(`../../modules/utilities`);

/*
 * Wait for the delay to be over.
 */
module.exports = async function __executeActionDelay (action, recUser) {

	if (!recUser) { throw new Error(`Cannot execute action "delay" unless a user is provided.`); }

	const sharedLogger = this.__dep(`sharedLogger`);
	const maxDelay = 15;
	const markAsTyping = (typeof action.markAsTyping === `undefined` ? true : action.markAsTyping);
	const delay = (action.delay <= maxDelay ? action.delay : maxDelay);

	// Warn about exceeding the max delay.
	if (action.delay > maxDelay) {
		sharedLogger.warn(`Action "delay" of "${action.delay}" seconds is too long, capped at ${maxDelay}.`);
	}

	// Mark as typing and then wait.
	if (markAsTyping) {
		const adapter = this.__dep(`adapter-${recUser.channel.name}`);
		await adapter.markAsTypingOn(recUser);
	}

	await utilities.delay(delay);

};
