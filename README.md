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

### Production
To deploy one of the media providers' services to production run the appropriate command:

`
npm run deploy-demo-production
npm run deploy-battabox-production
npm run deploy-sabc-production
npm run deploy-thestar-production
`

### Staging
To deploy one of the media providers' services to staging run the appropriate command:

`
npm run deploy-demo-staging
npm run deploy-battabox-staging
npm run deploy-sabc-staging
npm run deploy-thestar-staging
`

## Handy Database Queries

### Total users
Returns the total number of user documents in the database.
`db.user.count()`

### Total articles
Returns the total number of article documents in the database.
`db.article.count()`

### Total aggregate article reads
Returns the aggregated number of article reads across all articles.
`db.article.aggregate([{ $unwind: "$_readByUsers" }, { $group: { _id: {}, count: { "$sum": 1 } } }, { $group: { _id: {}, numReads: { $push: { _readByUsers: "$_id.readByUsers", count: "$count" } } } }])`
