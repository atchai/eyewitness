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

### Install

1. Setup SSH keys registered with GitHub so that Docker will be able to fetch the `hippocamp` dependency from GitHub.
These should be saved to `./ssl/id_eyewitness` and `./ssl/id_eyewitness.pub`.

### Run

1. Open a terminal window and run ngrok with: `npm run ngrok` or `ngrok http 5000 --region eu -subdomain={{CUSTOM_SUBDOMAIN}}`.
2. Open a second terminal window and run MongoDB and MongoClient with: `docker-compose up mongodb mongoclient`.
3. Open a third terminal window and run the example chatbot with: `docker-compose up bot`.

## Deploying Eyewitness
You must use one of the "deploy" scripts to deploy Eyewitness automatically. For instructions on how to setup the hosting, please refer to the DEPLOY.md file.

Deployments need to be performed for:

 - The Eyewitness bot and Read Server - using deploy commands in this repo.
 - The UI in the [Eyewitness UI repo](https://github.com/atchai/eyewitness-ui)
 
The deployment commands (described below) are identical for both repositories.

### Configuration files

There are a number of configuration files for the different providers and environments (development/staging/production). 
The configuration files use a system of inheritance to avoid duplication, managed by the [Config-Ninja](https://github.com/saikojosh/Config-Ninja) package.

The config for development is `app/config/development.config.json` which inherits from `app/config/production.config.json`.
You may optionally add `app/config/local.config.json` to override the standard development configuration.

For each provider there is a config for staging 
`app/config/providers/[provider ID].staging.config.json` which inherits from 
`app/config/staging.config.json` which inherits from
`app/config/production.config.json` 

For each provider there is a config for production 
`app/config/providers/[provider ID].production.config.json` which inherits from 
`app/config/production.config.json` 

### Pre-deployment commands

[Install Heroku CLI](https://cli.heroku.com) and then login:

```
heroku login
heroku container:login
```

### Staging Deployment Commands
To deploy one of the media providers' services to staging run the appropriate command:

```
npm run deploy-demo-staging
npm run deploy-battabox-staging
npm run deploy-sabc-staging
npm run deploy-thestar-staging
```
or to deploy all:

```
npm run deploy-all-staging
```

### Production Deployment Commands
To deploy one of the media providers' services to production run the appropriate command:

```
npm run deploy-demo-production
npm run deploy-battabox-production
npm run deploy-sabc-production
npm run deploy-thestar-production
```

or to deploy all:

```
npm run deploy-all-production
```

### Verifying a deployment

After deploying to a staging or production environment you should check it is working.

To verify the bot: 

1. Find the provider name from the bot config file for the provider.
2. Search for the bot with that name on Facebook messenger (you need to be given access for non-production environments)
3. You can then type `$whoami` or `$debug` to check version info, and chat to the bot to test features that were changed.

To verify the UI:

1. Find the URL for the UI in the `uiServer` property of the bot config file for the provider.
2. Open the URL in the browser, log-in with the credentials under `basicAuth` from the config file in the UI repo
3. Also try appending `/health-check` the URL to check the version number.

## Handy Database Queries

### Total users
Returns the total number of user documents in the database.
`db.user.count()`

### Total articles
Returns the total number of article documents in the database.
`db.article.count()`

### Total aggregate article reads
Returns the aggregated number of article reads across all articles.
```
db.article.aggregate([
    { $unwind: "$_readByUsers" },
    { $group: { _id: {}, count: { "$sum": 1 } } },
    { $group: { _id: {}, numReads: { $push: { _readByUsers: "$_id.readByUsers", count: "$count" } } } }
])
```
