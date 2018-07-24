'use strict';

const extender = require(`object-extender`);

/*
 * Execute the memory update operations specified in the action.
 */
module.exports = async function __executeActionUpdateMemory (action, recUser) {

	if (!recUser) { throw new Error(`Cannot execute action "update memory" unless a user is provided.`); }

	const MessageObject = this.__dep(`MessageObject`);
	const sharedLogger = this.__dep(`sharedLogger`);
	const variables = extender.merge(this.options.messageVariables, recUser.profile, recUser.appData);
	const errorMessage = action.errorMessage || `There was a problem saving data into memory.`;

	try {
		await this.updateUserMemory(variables, action.memory, recUser, errorMessage);
	}
	catch (err) {

		const validationErrorMessage = MessageObject.outgoing(recUser, {
			text: err.message,
		});

		await this.sendMessage(recUser, validationErrorMessage);
		sharedLogger.error(`Failed to execute update memory from action because of "${err}".`);
		return false;

	}

	return true;

};
