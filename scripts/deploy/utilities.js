'use strict';

/*
 * DEPLOY UTILITIES
 */

const path = require(`path`);
const { spawn } = require(`child_process`);

const WORKING_DIR = path.join(__dirname, `../../`);

/*
 * Executes the given command and returns a promise.
 */
async function execute (command) {

	const output = await new Promise((resolve, reject) => {

		const [ commandToRun, ...commandArgs ] = command.split(/\s+/g);

		const child = spawn(commandToRun, commandArgs, {
			cwd: WORKING_DIR,
			env: process.env,
			shell: true,
		});

		let stdout = ``;
		let stderr = ``;

		child.stdout.on(`data`, data => {
			stdout += data;
			process.stdout.write(data);
		});
		child.stderr.on(`data`, data => {
			stderr += data;
			process.stderr.write(data);
		});

		child.on(`error`, err => reject(err));

		child.on(`close`, (code) => {
			if (code) {
				const err = new Error(`Command exited unexpectedly with error code "${code}"!`);
				err.stderr = stderr;
				return reject(err);
			}

			return resolve(stdout);
		});

	});

	return output;

}

/*
 * Registers a new task definition on AWS.
 */
async function registerTaskDefinition (awsProfile, awsRegion, taskFamily, taskDefinition) {

	// Prepare the AWS CLI command.
	const escapedContainerJson = JSON.stringify(taskDefinition.containerDefinitions).replace(/"/g, `\\"`);
	const registerTaskDefinitionArgs = [
		`--profile "${awsProfile}"`,
		`--region "${awsRegion}"`,
		`--output "json"`,
		`--family "${taskFamily}"`,
		`--container-definitions "${escapedContainerJson}"`,
	].join(` `);

	// Execute the AWS CLI command.
	const newTaskDefinitionOutput = await execute(`aws ecs register-task-definition ${registerTaskDefinitionArgs}`);
	const newTaskDefinition = JSON.parse(newTaskDefinitionOutput).taskDefinition;

	return newTaskDefinition;

}

/*
 *  Updates the given service on AWS.
 */
async function updateService (awsProfile, awsRegion, clusterName, serviceName, taskDefinition) {

	// Prepare the AWS CLI command.
	const updateServiceArgs = [
		`--profile "${awsProfile}"`,
		`--region "${awsRegion}"`,
		`--output "json"`,
		`--cluster "${clusterName}"`,
		`--service "${serviceName}"`,
		`--task-definition "${taskDefinition.family}:${taskDefinition.revision}"`,
	].join(` `);

	// Execute the AWS CLI command.
	await execute(`aws ecs update-service ${updateServiceArgs}`);

}

/*
 * Export.
 */
module.exports = {
	execute,
	registerTaskDefinition,
	updateService,
};
