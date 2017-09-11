'use strict';

/*
 * DEPLOY SCRIPT
 */

/* eslint node/no-unpublished-require: 0 */

const path = require(`path`);
const { spawn } = require(`child_process`);
const extender = require(`object-extender`);

const WORKING_DIR = path.join(__dirname, `../../`);
const AWS_PROFILE = `eyewitness-ci-atchai`;
const AWS_REGION = `eu-west-1`;
const AWS_REPO_URL = `538881967423.dkr.ecr.eu-west-1.amazonaws.com`;
const AWS_TASK_FAMILY = `eyewitness-app`;
const IMAGE_NAME = `eyewitness-app`;
const cache = {};

/*
 * Executes the given command and returns a promise.
 */
function execute (command) {

	return new Promise((resolve, reject) => {

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

}

// Grab the version argument.
const versionType = process.argv[2].split(`=`)[1];
if (versionType !== `major` && versionType !== `minor` && versionType !== `patch`) {
	throw new Error(`--version flag is required and must be one of "major", "minor" or "patch".`);
}

// Grab the provider argument.
const provider = process.argv[3].split(`=`)[1];
if (!provider) {
	throw new Error(`--provider flag is required.`);
}

// Grab the environment argument.
const environment = process.argv[4].split(`=`)[1];
if (environment !== `production` && environment !== `staging`) {
	throw new Error(`--environment flag is required and must be one of "production" or "staging".`);
}

// Figure out the correct resources to use for the given environment.
const taskDefinitionOriginal = require(`./${provider}.config.json`);
const branch = (environment === `production` ? `master` : `develop`);
const clusterName = `eyewitness-${environment}`;
const awsLogsGroup = `eyewitness/${provider}/${environment}`;
const appServiceName = `eyewitness-app-${provider}-${environment}`;
const readServerServiceName = `eyewitness-read-${provider}-${environment}`;

// Begin!
Promise.resolve()

	// Switch to the correct branch.
	.then(() => process.stdout.write(`\n\n[Switching to ${branch} branch]\n`))
	.then(() => execute(`git checkout ${branch}`))

	// Bump the version.
	.then(() => process.stdout.write(`\n\n[Bumping version number]\n`))
	.then(() => execute(`npm version ${versionType}`))
	.then(stdout => cache.version = stdout.match(/v(\d+\.\d+\.\d+)/)[1])

	// Get Docker login token.
	.then(() => process.stdout.write(`\n\n[Retrieving Docker login token from AWS]\n`))
	.then(() => execute(`aws ecr get-login --no-include-email --profile "${AWS_PROFILE}" --region "${AWS_REGION}"`))
	.then(dockerLoginCommand => cache.dockerLoginCommand = dockerLoginCommand)

	// Login to Docker.
	.then(() => process.stdout.write(`\n\n[Logging into AWS Docker repository]\n`))
	.then(() => execute(cache.dockerLoginCommand))

	// Build and tag new Docker image.
	.then(() => process.stdout.write(`\n\n[Building and tagging Docker image]\n`))
	.then(() => execute(`docker build -t ${IMAGE_NAME} -t ${AWS_REPO_URL}/${IMAGE_NAME}:latest -t ${AWS_REPO_URL}/${IMAGE_NAME}:${cache.version} .`))

	// Push to AWS container repo.
	.then(() => process.stdout.write(`\n\n[Pushing Docker image to AWS repository]\n`))
	.then(() => execute(`docker push ${AWS_REPO_URL}/${IMAGE_NAME}:latest`))
	.then(() => execute(`docker push ${AWS_REPO_URL}/${IMAGE_NAME}:${cache.version}`))

	// Update AWS ECS task definitions with new image tag.
	.then(() => process.stdout.write(`\n\n[Updating AWS ECS task definition]\n`))
	.then(() => {

		// Prepare the task definition.
		const taskDefinition = extender.clone(taskDefinitionOriginal);
		const appTask = taskDefinition[`eyewitness-app`];
		const readServerTask = taskDefinition[`eyewitness-read-server`];
		const appContainer = appTask.containerDefinitions[0];
		const readServerContainer = readServerTask.containerDefinitions[0];

		// Set NODE_ENV environment variable on containers.
		appContainer.environment.find(item => item.name === `NODE_ENV`).value = environment;
		readServerContainer.environment.find(item => item.name === `NODE_ENV`).value = environment;

		// Set AWS logs config on containers.
		appContainer.logConfiguration.options[`awslogs-region`] = AWS_REGION;
		appContainer.logConfiguration.options[`awslogs-group`] = awsLogsGroup;
		readServerContainer.logConfiguration.options[`awslogs-region`] = AWS_REGION;
		readServerContainer.logConfiguration.options[`awslogs-group`] = awsLogsGroup;

		// Prepare the AWS CLI commands.
		const escapedAppContainerJson = JSON.stringify(appTask.containerDefinitions).replace(/"/g, `\\"`);
		const escapedReadServerContainerJson = JSON.stringify(readServerTask.containerDefinitions).replace(/"/g, `\\"`);
		const appArgs = [
			`--profile "${AWS_PROFILE}"`,
			`--region "${AWS_REGION}"`,
			`--output "json"`,
			`--family "${AWS_TASK_FAMILY}"`,
			`--container-definitions "${escapedAppContainerJson}"`,
		].join(` `);
		const readServerArgs = [
			`--profile "${AWS_PROFILE}"`,
			`--region "${AWS_REGION}"`,
			`--output "json"`,
			`--family "${AWS_TASK_FAMILY}"`,
			`--container-definitions "${escapedReadServerContainerJson}"`,
		].join(` `);

		// Execute the AWS CLI commands.
		return Promise.all([
			execute(`aws ecs register-task-definition ${appArgs}`),
			execute(`aws ecs register-task-definition ${readServerArgs}`),
		]);

	})
	.then(([ appTaskDefinition, readServerTaskDefinition ]) => {
		cache.newTaskDefinitions.app = JSON.parse(appTaskDefinition).taskDefinition;
		cache.newTaskDefinitions.readServer = JSON.parse(readServerTaskDefinition).taskDefinition;
	})

	// Update AWS ECS services with new task definition.
	.then(() => process.stdout.write(`\n\n[Updating AWS ECS service]\n`))
	.then(() => {

		// Prepare the AWS CLI commands.
		const appTaskDefinition = cache.newTaskDefinitions.app;
		const readServerTaskDefinition = cache.newTaskDefinitions.readServer;
		const appArgs = [
			`--profile "${AWS_PROFILE}"`,
			`--region "${AWS_REGION}"`,
			`--output "json"`,
			`--cluster "${clusterName}"`,
			`--service "${appServiceName}"`,
			`--task-definition "${appTaskDefinition.family}:${appTaskDefinition.revision}"`,
		].join(` `);
		const readServerArgs = [
			`--profile "${AWS_PROFILE}"`,
			`--region "${AWS_REGION}"`,
			`--output "json"`,
			`--cluster "${clusterName}"`,
			`--service "${readServerServiceName}"`,
			`--task-definition "${readServerTaskDefinition.family}:${readServerTaskDefinition.revision}"`,
		].join(` `);

		// Execute the AWS CLI commands.
		return Promise.all([
			execute(`aws ecs update-service ${appArgs}`),
			execute(`aws ecs update-service ${readServerArgs}`),
		]);

	})

	// Push the changes and tag to the remote repo.
	.then(() => process.stdout.write(`\n\n[Pushing version change to Git repository]\n`))
	.then(() => execute(`git push && git push origin v${cache.version}`))

	// Tidy up.
	.then(() => {
		process.stdout.write(`\n\n[Done!]\n`);
	})
	.catch(err => {
		process.stderr.write(`\n\n[Error!]\n`);

		if ((err.stderr || ``).match(/Git working directory not clean/i)) {
			process.stderr.write(`Git working directory not clean! You must commit all your changes.\n`);
		}
		else {
			process.stderr.write(`${err.message}\n`);
		}

		process.stderr.write(`\n`);
	});
