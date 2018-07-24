'use strict';

/*
 * WORKFLOW: ACTIONS
 * Functions for executing actions specified in conversation flows.
 */

const __executeActionChangeFlow = require(`./changeFlow`);
const __executeActionDelay = require(`./delay`);
const __executeActionDisableBot = require(`./disableBot`);
const __executeActionEnableBot = require(`./enableBot`);
const __executeActionExecuteHook = require(`./executeHook`);
const __executeActionMarkAsTyping = require(`./markAsTyping`);
const __executeActionScheduleTask = require(`./scheduleTask`);
const __executeActionSendMessage = require(`./sendMessage`);
const __executeActionTrackEvent = require(`./trackEvent`);
const __executeActionTrackUser = require(`./trackUser`);
const __executeActionUpdateMemory = require(`./updateMemory`);
const __executeActionWipeMemory = require(`./wipeMemory`);

/*
 * Executes a single action. Returns true if subsequent actions are allowed to be executed, or false otherwise.
 */
async function executeSingleAction (action, recUser, resources, sharedLogger) {

	const { index, typeName, typeValue, message } = resources;
	const templateVariables = this.prepareVariables(recUser);

	// If we have a conditional, make sure it evaluates to a truthy value, otherwise we skip this action.
	if (!this.evaluateConditional(action.conditional, templateVariables)) {
		sharedLogger.silly(`Skipping action #${index + 1} "${action.type}" in ${typeName} "${typeValue}".`);
		return true;
	}

	sharedLogger.silly(`Executing action #${index + 1} "${action.type}" in ${typeName} "${typeValue}"...`);

	// What do we need to do for this action?
	switch (action.type) {

		case `change-flow`:
			await this.__executeActionChangeFlow(action, recUser, message); // eslint-disable-line no-await-in-loop
			return false; // No further actions should be executed after moving to another flow.

		case `delay`:
			await this.__executeActionDelay(action, recUser); // eslint-disable-line no-await-in-loop
			break;

		case `disable-bot`:
			await this.__executeActionDisableBot(action, recUser); // eslint-disable-line no-await-in-loop
			return false; // No further actions should be executed after disabling the bot.

		case `enable-bot`:
			await this.__executeActionEnableBot(action, recUser); // eslint-disable-line no-await-in-loop
			break;

		case `execute-hook`: {
			const continueWithActions = await this.__executeActionExecuteHook(action, recUser, message); // eslint-disable-line no-await-in-loop
			if (!continueWithActions) { return false; } // No further actions should be executed if a hook fails.
			break;
		}

		case `mark-as-typing`:
			await this.__executeActionMarkAsTyping(action, recUser); // eslint-disable-line no-await-in-loop
			break;

		case `schedule-task`:
			await this.__executeActionScheduleTask(action, recUser); // eslint-disable-line no-await-in-loop
			break;

		case `send-message`:
			await this.__executeActionSendMessage(action, recUser); // eslint-disable-line no-await-in-loop
			break;

		case `track-event`:
			await this.__executeActionTrackEvent(action, recUser); // eslint-disable-line no-await-in-loop
			break;

		case `track-user`:
			await this.__executeActionTrackUser(action, recUser); // eslint-disable-line no-await-in-loop
			break;

		case `update-memory`: {
			const continueWithActions = await this.__executeActionUpdateMemory(action, recUser); // eslint-disable-line no-await-in-loop
			if (!continueWithActions) { return false; } // No further actions should be executed if memory update fails.
			break;
		}

		case `wipe-memory`:
			await this.__executeActionWipeMemory(action, recUser); // eslint-disable-line no-await-in-loop
			break;

		default: throw new Error(`Invalid action "${action.type}".`);

	}

	// Allow any subsequent actions to be executed.
	return true;

}

/*
 * Execute all the given actions in order. Returns true if the current flow can continue, or false if the current flow
 * must stop because one of the actions redirected us to a new flow.
 */
async function executeActions (typeName, typeValue, actions, recUser, message) {

	if (!actions || !actions.length) { return true; }

	const sharedLogger = this.__dep(`sharedLogger`);

	// Skip if the bot has been disabled for this user.
	if (this.skipIfBotDisabled(`execute actions`, recUser)) {
		return false;
	}

	// Iterate over the actions in the order they are defined.
	for (let index = 0; index < actions.length; index++) {
		const action = actions[index];
		const resources = { index, typeName, typeValue, message };
		const proceedToNextAction = await executeSingleAction.call(this, action, recUser, resources, sharedLogger); // eslint-disable-line no-await-in-loop

		if (!proceedToNextAction) { return false; }
	}

	return true;

}

/*
 * Export.
 */
module.exports = {
	executeActions,
	__executeActionChangeFlow,
	__executeActionDelay,
	__executeActionDisableBot,
	__executeActionEnableBot,
	__executeActionExecuteHook,
	__executeActionMarkAsTyping,
	__executeActionScheduleTask,
	__executeActionSendMessage,
	__executeActionTrackEvent,
	__executeActionTrackUser,
	__executeActionUpdateMemory,
	__executeActionWipeMemory,
};
