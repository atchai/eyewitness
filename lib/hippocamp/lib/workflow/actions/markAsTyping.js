'use strict';

/*
 * Marks typing on/off if the adapter supports it. Defaults to marking as "on".
 */
module.exports = async function __executeActionMarkAsTyping (action, recUser) {

	if (!recUser) { throw new Error(`Cannot execute action "mark as typing" unless a user is provided.`); }

	const adapter = this.__dep(`adapter-${recUser.channel.name}`);
	const state = (typeof action.state === `undefined` ? true : action.state);
	const method = (state ? `markAsTypingOn` : `markAsTypingOff`);

	await adapter[method](recUser);

};
