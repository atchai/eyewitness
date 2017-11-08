# Eyewitness Chatbot
Chatbot to allow people to receive news from providers and submit their own stories.

## Dependencies

#### Required
* Node.js (see the "engines" property in package.json for supported versions).
* Npm package manager.

#### Optional
* [Docker](https://www.docker.com/community-edition#/download) 17+ (for local testing)
* [Ngrok](https://ngrok.com/) (for local testing)
* MongoDB (if not using Docker for local testing)

## Local Development
When developing locally I like to use Docker (for environment encapsulation). I also use multiple terminal windows/tabs rather than starting all the Docker containers in one window as this makes it easier to read the application's terminal output.

1. Open a terminal window and run ngrok with: `ngrok http 5000 --region eu -subdomain={{CUSTOM_SUBDOMAIN}}`.
2. Open a second terminal window and run MongoDB and MongoClient with: `docker-compose up mongodb mongoclient`.
3. Open a third terminal window and run the example chatbot with: `docker-compose up app`.

## Deploying Eyewitness
You must use the "deploy" script to deploy Eyewitness.

To deploy Eyewitness use the "deploy" script `npm run deploy [version-bump] [provider] [environment]` specifying the type of version bump (e.g. patch, minor, major, existing), the provider ID and the environment (production/staging).

You only need to bump the version for the first deployment. Subsequent deploys can use "existing" for the version bump argument to avoid rebuilding the entire Docker image unnecessarily.

### Production
If you need to rebuild the Docker image during deployment use one of these commands:

`
npm run deploy minor battabox production
npm run deploy minor sabc production
npm run deploy minor thestar production
`

If you want to deploy the existing Docker image use one of these commands:

`
npm run deploy existing battabox production
npm run deploy existing sabc production
npm run deploy existing thestar production
`

### Staging
If you need to rebuild the Docker image during deployment use one of these commands:

`
npm run deploy patch battabox staging
npm run deploy patch sabc staging
npm run deploy patch thestar staging
`

If you want to deploy the existing Docker image use one of these commands:

`
npm run deploy existing battabox staging
npm run deploy existing sabc staging
npm run deploy existing thestar staging
`
