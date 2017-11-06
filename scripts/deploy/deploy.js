'use strict';

/*
 * DEPLOY SCRIPT
 */

/* eslint node/no-unpublished-require: 0 */

const extender = require(`object-extender`);
const { execute } = require(`./utilities`);

const AWS_PROFILE = `eyewitness-ci`;
const AWS_REGION = `eu-west-1`;
const AWS_REPO_URL = `614459117250.dkr.ecr.eu-west-1.amazonaws.com`;
const IMAGE_NAME = `eyewitness-app`;
const AWS_REPO_IMAGE_URL = `${AWS_REPO_URL}/${IMAGE_NAME}`;
const ALLOWED_VERSION_TYPES = [`major`, `minor`, `patch`, `existing`];
const ALLOWED_ENVIRONMENTS = [`production`, `staging`];

/*
 * The main function.
 */
async function main () {

	// Grab the version argument.
	const versionType = process.argv[2];
	if (!ALLOWED_VERSION_TYPES.includes(versionType)) {
		throw new Error(`Version argument is required and must be one of: ${ALLOWED_VERSION_TYPES}.`);
	}

	// Grab the provider argument.
	const provider = process.argv[3];
	if (!provider) {
		throw new Error(`Provider argument is required.`);
	}

	// Grab the environment argument.
	const environment = process.argv[4];
	if (!ALLOWED_ENVIRONMENTS.includes(environment)) {
		throw new Error(`Environment argument is required and must be one of: ${ALLOWED_ENVIRONMENTS}.`);
	}

	// Figure out the correct resources to use for the given environment.
	const taskDefinitionOriginal = require(`./tasks/${provider}.config.json`);  // eslint-disable-line
	const branch = (environment === `production` ? `master` : `develop`);
	const clusterName = `eyewitness-${environment}`;
	const awsLogsGroup = `eyewitness/${environment}/${provider}`;
	const botServiceName = `eyewitness-bot-${provider}`;
	const readServerServiceName = `eyewitness-read-${provider}`;
	const botTaskFamily = botServiceName;
	const readServerTaskFamily = readServerServiceName;
	let version;

	// Switch to the correct branch.
	process.stdout.write(`\n\n[Switching to ${branch} branch]\n`);
	await execute(`git checkout ${branch}`);

	// Don't do the following if we aren't bumping the version number.
	if (versionType !== `existing`) {

		// Bump the version.
		process.stdout.write(`\n\n[Bumping version number]\n`);
		const versionString = await execute(`npm version ${versionType}`);
		version = versionString.match(/v(\d+\.\d+\.\d+)/)[1];

		// Get Docker login token.
		process.stdout.write(`\n\n[Retrieving Docker login token from AWS]\n`);
		const dockerLoginCommand = await execute(
			`aws ecr get-login --no-include-email --profile "${AWS_PROFILE}" --region "${AWS_REGION}"`
		);

		// Login to Docker.
		process.stdout.write(`\n\n[Logging into AWS Docker repository]\n`);
		await execute(dockerLoginCommand);

		// Build and tag new Docker image.
		process.stdout.write(`\n\n[Building and tagging Docker image]\n`);
		await execute(
			`docker build -t ${IMAGE_NAME} -t ${AWS_REPO_IMAGE_URL}:latest -t ${AWS_REPO_IMAGE_URL}:${version} .`
		);

		// Push to AWS container repo (one after the other to take advantage of layer caching in ECR).
		process.stdout.write(`\n\n[Pushing Docker image to AWS repository]\n`);
		await execute(`docker push ${AWS_REPO_IMAGE_URL}:latest`);
		await execute(`docker push ${AWS_REPO_IMAGE_URL}:${version}`);

	}

	// Update AWS ECS task definitions with new image tag.
	process.stdout.write(`\n\n[Updating AWS ECS task definition]\n`);

	// Prepare the task definition.
	const taskDefinition = extender.clone(taskDefinitionOriginal);
	const botTask = taskDefinition[`bot`];
	const readServerTask = taskDefinition[`read-server`];
	const botContainer = botTask.containerDefinitions[0];
	const readServerContainer = readServerTask.containerDefinitions[0];

	// Set NODE_ENV environment variable on containers.
	botContainer.environment.find(item => item.name === `NODE_ENV`).value = environment;
	readServerContainer.environment.find(item => item.name === `NODE_ENV`).value = environment;

	// Set AWS logs config on containers.
	botContainer.logConfiguration.options[`awslogs-region`] = AWS_REGION;
	botContainer.logConfiguration.options[`awslogs-group`] = awsLogsGroup;
	readServerContainer.logConfiguration.options[`awslogs-region`] = AWS_REGION;
	readServerContainer.logConfiguration.options[`awslogs-group`] = awsLogsGroup;

	// Prepare the AWS CLI commands.
	const escapedBotContainerJson = JSON.stringify(botTask.containerDefinitions).replace(/"/g, `\\"`);
	const escapedReadServerContainerJson = JSON.stringify(readServerTask.containerDefinitions).replace(/"/g, `\\"`);
	const registerTaskDefinitionBotArgs = [
		`--profile "${AWS_PROFILE}"`,
		`--region "${AWS_REGION}"`,
		`--output "json"`,
		`--family "${botTaskFamily}"`,
		`--container-definitions "${escapedBotContainerJson}"`,
	].join(` `);
	const registerTaskDefinitionReadServerArgs = [
		`--profile "${AWS_PROFILE}"`,
		`--region "${AWS_REGION}"`,
		`--output "json"`,
		`--family "${readServerTaskFamily}"`,
		`--container-definitions "${escapedReadServerContainerJson}"`,
	].join(` `);

	// Execute the AWS CLI commands.
	const [ botTaskDefinition, readServerTaskDefinition ] = await Promise.all([
		execute(`aws ecs register-task-definition ${registerTaskDefinitionBotArgs}`),
		execute(`aws ecs register-task-definition ${registerTaskDefinitionReadServerArgs}`),
	]);

	const newTaskDefinitions = {
		bot: JSON.parse(botTaskDefinition).taskDefinition,
		readServer: JSON.parse(readServerTaskDefinition).taskDefinition,
	};

	// Update AWS ECS services with new task definition.
	process.stdout.write(`\n\n[Updating AWS ECS service]\n`);

	// Prepare the AWS CLI commands.
	const updateServiceBotArgs = [
		`--profile "${AWS_PROFILE}"`,
		`--region "${AWS_REGION}"`,
		`--output "json"`,
		`--cluster "${clusterName}"`,
		`--service "${botServiceName}"`,
		`--task-definition "${newTaskDefinitions.bot.family}:${newTaskDefinitions.bot.revision}"`,
	].join(` `);
	const updateServiceReadServerArgs = [
		`--profile "${AWS_PROFILE}"`,
		`--region "${AWS_REGION}"`,
		`--output "json"`,
		`--cluster "${clusterName}"`,
		`--service "${readServerServiceName}"`,
		`--task-definition "${newTaskDefinitions.readServer.family}:${newTaskDefinitions.readServer.revision}"`,
	].join(` `);

	// Execute the AWS CLI commands (in parallel).
	await Promise.all([
		execute(`aws ecs update-service ${updateServiceBotArgs}`),
		execute(`aws ecs update-service ${updateServiceReadServerArgs}`),
	]);

	// Don't do the following if we aren't bumping the version number.
	if (versionType !== `existing`) {

		// Push the changes and tag to the remote repo.
		process.stdout.write(`\n\n[Pushing version change to Git repository]\n`);
		await execute(`git push && git push origin v${version}`);

	}

	// Tidy up.
	process.stdout.write(`\n\n[Done!]\n`);

}

/*
 * Execute script.
 */
main()
	.catch(err => {

		process.stderr.write(`\n\n[Error!]\n`);

		if ((err.stderr || ``).match(/Git working directory not clean/i)) {
			process.stderr.write(`Git working directory not clean! You must commit all your changes.\n`);
		}
		else {
			process.stderr.write(`${err.stack}\n`);
		}

		process.stderr.write(`\n`);

	});
