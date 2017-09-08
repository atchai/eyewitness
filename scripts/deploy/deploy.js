'use strict';

/*
 * DEPLOY SCRIPT
 */

/* eslint node/no-unpublished-require: 0 */

const path = require(`path`);
const { spawn } = require(`child_process`);
const extender = require(`object-extender`);
const taskDefinitionOriginal = require(`./task.config.json`);

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

// Grab the environment argument.
const environment = process.argv[3].split(`=`)[1];
if (environment !== `production` && versionType !== `staging`) {
	throw new Error(`--environment flag is required and must be one of "production" or "staging".`);
}

// Figure out the correct resources to use for the given environment.
const branch = (environment === `production` ? `master` : `develop`);
const clusterName = `mindbot`;
const serviceName = `mindbot-${environment}`;
const awsLogsGroup = `mindbot-${environment}`;
const facebookPageId = (environment === `production` ? `1723939907886378` : `525442377791543`);
const facebookPageToken = (environment === `production` ? `EAAY1bfU5pIUBABsxmWmFZAyqcXpL9PnhuqABagsRfz2uT8Rp779kN11RskvRrwDom6RY4pWUvZATC2W0I4SpEbZCSpr4ddYS6Wkp6dZB037uAuRHHFQAkNtJBl07WM6b5v1HjsfzdcG1IMEWu36ruPpueszOfSEG0SGzURfXMQZDZD` : `EAAFDH119eMoBAIQqlduvroJtP8bECEPWlqpYAnrroAWooFZAReaEVn4qNmI7iVepUfLsDteVFIFjxT9Dkj3jIZBEEAIdppoy7UBqgKWaZCO5B17n1ZAcFb232lPpnhQ7jBD2r2PkmScdVNtcfBqCzsWutCFsCVfAZBKRA55WmEAZDZD`);
const databaseHost = (environment === `production` ? `ds119194-a0.mlab.com` : `mongo`);
const databaseReplicaSet = (environment === `production` ? `rs-ds119194` : ``);
const databasePort = (environment === `production` ? `19194` : `27017`);
const databaseUser = (environment === `production` ? `mindbot-user-UYjDel4MXYy0WxaWMESK` : `mindbot-user`);
const databasePass = (environment === `production` ? `sSBnD8sb8i6b5oM04VrA8zshScP6eoP5REMbiZt9` : `12345678`);

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

	// Update AWS ECS task definition with new image tag.
	.then(() => process.stdout.write(`\n\n[Updating AWS ECS task definition]\n`))
	.then(() => {

		// Prepare the task definition.
		const taskDefinition = extender.clone(taskDefinitionOriginal);
		const appContainer = taskDefinition.containerDefinitions[0];
		const redisContainer = taskDefinition.containerDefinitions[1];
		const appFacebookPageIdEnvVar = appContainer.environment.find(item => item.name === `FACEBOOK_PAGE_ID`);
		const appFacebookPageTokenEnvVar = appContainer.environment.find(item => item.name === `FACEBOOK_PAGE_TOKEN`);
		const appMongoHostEnvVar = appContainer.environment.find(item => item.name === `MONGODB_HOST`);
		const appMongoReplicaSetEnvVar = appContainer.environment.find(item => item.name === `MONGODB_REPLICA_SET`);
		const appMongoPortEnvVar = appContainer.environment.find(item => item.name === `MONGODB_PORT`);
		const appMongoUserEnvVar = appContainer.environment.find(item => item.name === `MONGODB_USER`);
		const appMongoPassEnvVar = appContainer.environment.find(item => item.name === `MONGODB_PASS`);

		// Apply logs configuration.
		appContainer.logConfiguration.options[`awslogs-region`] = AWS_REGION;
		appContainer.logConfiguration.options[`awslogs-group`] = awsLogsGroup;
		redisContainer.logConfiguration.options[`awslogs-region`] = AWS_REGION;
		redisContainer.logConfiguration.options[`awslogs-group`] = awsLogsGroup;

		// Update environment variables.
		appFacebookPageIdEnvVar.value = facebookPageId;
		appFacebookPageTokenEnvVar.value = facebookPageToken;
		appMongoHostEnvVar.value = databaseHost;
		appMongoReplicaSetEnvVar.value = databaseReplicaSet;
		appMongoPortEnvVar.value = databasePort;
		appMongoUserEnvVar.value = databaseUser;
		appMongoPassEnvVar.value = databasePass;

		// Update the host ports for staging deployments.
		if (environment !== `production`) {
			const appRabbitMqUrlEnvVar = appContainer.environment.find(item => item.name === `RABBITMQ_URL`);

			appRabbitMqUrlEnvVar.value = appRabbitMqUrlEnvVar.value.replace(/:5672$/, `:5673`);
			appContainer.portMappings[0].hostPort = 81;
			appContainer.portMappings[1].hostPort = 8081;
			redisContainer.portMappings[0].hostPort = 5673;
		}

		const containerDefinitionsJson = JSON.stringify(taskDefinition.containerDefinitions);
		const escapedContainerDefinitionsJson = containerDefinitionsJson.replace(/"/g, `\\"`);
		const args = [
			`--profile "${AWS_PROFILE}"`,
			`--region "${AWS_REGION}"`,
			`--output "json"`,
			`--family "${AWS_TASK_FAMILY}"`,
			`--container-definitions "${escapedContainerDefinitionsJson}"`,
		].join(` `);

		return execute(`aws ecs register-task-definition ${args}`);

	})
	.then(newTaskDefinition => cache.newTaskDefinition = JSON.parse(newTaskDefinition).taskDefinition)

	// Update AWS ECS service with new task definition.
	.then(() => process.stdout.write(`\n\n[Updating AWS ECS service]\n`))
	.then(() => {

		const args = [
			`--profile "${AWS_PROFILE}"`,
			`--region "${AWS_REGION}"`,
			`--output "json"`,
			`--cluster "${clusterName}"`,
			`--service "${serviceName}"`,
			`--task-definition "${cache.newTaskDefinition.family}:${cache.newTaskDefinition.revision}"`,
		].join(` `);

		return execute(`aws ecs update-service ${args}`);

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
