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
 * Export.
 */
module.exports = {
	execute,
};
