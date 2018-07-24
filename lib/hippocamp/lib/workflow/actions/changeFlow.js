'use strict';

/*
 * Move to the given flow.
 */
module.exports = async function __executeActionChangeFlow (action, recUser, message) {
	if (!recUser) { throw new Error(`Cannot execute action "change flow" unless a user is provided.`); }
	await this.executeFlow(action.nextUri, recUser, message);
};
