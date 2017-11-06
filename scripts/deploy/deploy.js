'use strict';

/*
 * DEPLOY SCRIPT
 */

/* eslint node/no-unpublished-require: 0 */

const extender = require(`object-extender`);
const { execute, registerTaskDefinition, updateService } = require(`./utilities`);

const TASK_DEFINITION_ORIGINAL = require(`./task.config.json`);
const PORTS_CONFIG = require(`./ports.config.json`);
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
	const branch = (environment === `production` ? `master` : `develop`);
	const clusterName = `eyewitness-${environment}`;
	const awsLogsGroup = `eyewitness/${environment}/${provider}`;
	const serviceName = `eyewitness-${provider}`;
	const taskFamily = serviceName;
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

		// Push the changes and tag to the remote repo.
		process.stdout.write(`\n\n[Pushing version change to Git repository]\n`);
		await execute(`git push && git push origin v${version}`);

	}

	// Update AWS ECS task definitions with new image tag.
	process.stdout.write(`\n\n[Updating AWS ECS task definition]\n`);

	// Prepare the task definition.
	const taskDefinition = extender.clone(TASK_DEFINITION_ORIGINAL);
	const botContainer = taskDefinition.containerDefinitions[0];
	const readServerContainer = taskDefinition.containerDefinitions[1];

	// Set NODE_ENV environment variable on containers.
	botContainer.environment.find(item => item.name === `NODE_ENV`).value = environment;
	readServerContainer.environment.find(item => item.name === `NODE_ENV`).value = environment;

	// Set PROVIDER_ID environment variable on containers.
	botContainer.environment.find(item => item.name === `PROVIDER_ID`).value = provider;
	readServerContainer.environment.find(item => item.name === `PROVIDER_ID`).value = provider;

	// Set container ports.
	const botPort = PORTS_CONFIG.providers[provider] + PORTS_CONFIG.containerOffsets.bot;
	const readServerPort =  PORTS_CONFIG.providers[provider] + PORTS_CONFIG.containerOffsets.readServer;
	botContainer.portMappings[0].containerPort = botPort;
	readServerContainer.portMappings[0].containerPort = readServerPort;

	// Set AWS logs config on containers.
	botContainer.logConfiguration.options[`awslogs-region`] = AWS_REGION;
	botContainer.logConfiguration.options[`awslogs-group`] = awsLogsGroup;
	readServerContainer.logConfiguration.options[`awslogs-region`] = AWS_REGION;
	readServerContainer.logConfiguration.options[`awslogs-group`] = awsLogsGroup;

	// Right now AWS ECS requires us to create separate services for each exposed container.
	const botPseudoTaskDefinition = { containerDefinitions: [botContainer] };
	const readServerPseudoTaskDefinition = { containerDefinitions: [readServerContainer] };

	const newBotTaskDefinition =
		await registerTaskDefinition(AWS_PROFILE, AWS_REGION, `${taskFamily}-bot`, botPseudoTaskDefinition);
	const newReadServerTaskDefinition =
		await registerTaskDefinition(AWS_PROFILE, AWS_REGION, `${taskFamily}-read-server`, readServerPseudoTaskDefinition);

	// Update AWS ECS services with new task definition.
	process.stdout.write(`\n\n[Updating AWS ECS service]\n`);

	await updateService(AWS_PROFILE, AWS_REGION, clusterName, `${serviceName}-bot`, newBotTaskDefinition);
	await updateService(AWS_PROFILE, AWS_REGION, clusterName, `${serviceName}-read-server`, newReadServerTaskDefinition);

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
