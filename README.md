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

## Deploying to Staging
...

## Deploying to Production
...
