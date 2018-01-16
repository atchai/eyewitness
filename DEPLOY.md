# EYEWITNESS DEPLOYMENT NOTES

## Prerequisites
This guide assumes you'll be using Heroku to host the Eyewitness Bot and User Interface, and mLab to host the database.

## Getting Started

### On Your Machine
1. Install Heroku CLI.
2. Git clone the "eyewitness" repo.
3. Git clone the "eyewitness-ui" repo.

### Create a Facebook App
1. Create a page on Facebook that users will use to message your bot (if you don't already have one).
2. Create an app on Facebook.
3. Add the Messenger product to your Facebook app.

### Create a Database
1. Create an account at mlab.com.
2. Create a new shared database with the name "eyewitness-production".
3. Add a user with a long username and password.
4. Take note of the credentials of the user you just created, and the host and replica set value of the database for the next section.

## Deploy the Bot
The bot is the tool that communicates with users over Facebook Messenger.

### Prepare the Config
1. CD into the "eyewitness" directory.
2. Open the "/app/config/providers/default.production.config.json" config file.
3. Generate your own random string and put it in the "adapters.facebook.verifyToken" property.
4. Leave "adapters.facebook.accessToken" blank for now as we will get that from Facebook later.
5. Update the database connection string with the username, password, host and replica set value you got from mLab in the "databases.mongo.connectionString" property.
6. Add in a greeting message to be displayed to first time users in the "greetingText" property.
7. Put the name of your organisation in the "messageVariables.provider.name" property.
8. Put the URL to your RSS feed in the "messageVariables.provider.rssFeedUrl" property.
9. Put the UTC offset of your organisation in the "messageVariables.provider.timezoneOffset" property.
10. To setup the breaking news function, you can add the name of the RSS field and the expected value the bot should watch for in the "messageVariables.provider.itemPriorityField" and "messageVariables.provider.itemPriorityValue" properties. For example, the field might be "category" and the value might be "breaking-news".
11. Put your website's domain name in the "hippocampServer", "readServer", and "uiServer" properties.
12. Make sure there are no more items to replace that look like "<SOME_ITEM_TO_REPLACE>" anywhere in the config file.
13. Save and close the file.

### Setup Heroku
1. Run `heroku login` to login to Heroku.
2. Run `heroku container:login` to login to the Heroku image repository.
3. Run `heroku create eyewitness-bot --region eu` to create an empty app on Heroku for the bot.
4. Add an environment variable with `heroku config:set NODE_ENV=production -a eyewitness-bot`.
5. Add an environment variable with `heroku config:set PROVIDER_ID=default -a eyewitness-bot`.
6. Add an environment variable with `heroku config:set ENTRY_POINT=bot -a eyewitness-bot`.
7. Run `heroku domains:add eyewitness-bot.<DOMAIN_NAME> -a eyewitness-bot` replacing <DOMAIN_NAME> as appropriate.
8. Take note of the DNS target given to you by the previous command, e.g. "eyewitness-bot.sometest.com.herokudns.com".
9. Run `heroku container:push web -a eyewitness-bot` to deploy the bot.
10. Run `heroku dyno:resize hobby -a eyewitness-bot` to allow us to use SSL on the domain (costs apply, see Heroku pricing).

### Setup DNS
1. Add a CNAME DNS record to your domain "eyewitness-bot" which points to the DNS target given in the previous section.
2. Enable automatic SSL certificate management with `heroku certs:auto:enable -a eyewitness-bot`.
3. When the DNS has updated you should see some output by visiting `https://eyewitness-bot.<DOMAIN_NAME>/health-check` where <DOMAIN_NAME> is replaced with your domain.
4. In the Facebook app you created earlier, setup the webhook with the URL `https://eyewitness-bot.<DOMAIN_NAME>/api/adapter/facebook` and your verify token.

## Deploy the Read Server
The read server tracks how many times each story has been read and by which users.

### Setup Heroku
1. Run `heroku create eyewitness-rs --region eu` to create an empty app on Heroku for the read server.
2. Add an environment variable with `heroku config:set NODE_ENV=production -a eyewitness-rs`.
3. Add an environment variable with `heroku config:set PROVIDER_ID=default -a eyewitness-rs`.
4. Add an environment variable with `heroku config:set ENTRY_POINT=read-server -a eyewitness-rs`.
5. Run `heroku domains:add eyewitness-rs.<DOMAIN_NAME> -a eyewitness-rs` replacing <DOMAIN_NAME> as appropriate.
6. Take note of the DNS target given to you by the previous command, e.g. "eyewitness-rs.sometest.com.herokudns.com".
7. Run `heroku container:push web -a eyewitness-rs` to deploy the read server.

### Setup DNS
1. Add a CNAME DNS record to your domain "eyewitness-rs" which points to the DNS target given in the previous section.
2. When the DNS has updated you should see some output by visiting `https://eyewitness-rs.<DOMAIN_NAME>/health-check` where <DOMAIN_NAME> is replaced with your domain.

## Deploy the User Interface
The user interface is used by admins to message users of the bot, manage the stories the bot sends out, and more.

### Prepare the Config
1. CD into the "eyewitness-ui" directory.
2. Open the "/app/config/providers/default.production.config.json" config file.
3. Put the URL of the UI in the "server.externalUri" property, e.g. `https://eyewitness-ui.<DOMAIN_NAME>` replacing <DOMAIN_NAME> as appropriate.
4. Update the database connection string with the username, password, host and replica set value you got from mlab in the "databases.mongo.connectionString" property.
5. Put the ID of the Facebook page you created earlier in the "facebookPageId" property.
6. Put the URL of the bot in the "hippocampServer.baseUrl" property, e.g. `https://eyewitness-bot.<DOMAIN_NAME>` replacing <DOMAIN_NAME> as appropriate.
7. Make sure there are no more items to replace that look like "<SOME_ITEM_TO_REPLACE>" anywhere in the config file.
8. Save and close the file.

### Setup Heroku
1. Run `heroku create eyewitness-ui --region eu` to create an empty app on Heroku for the user interface.
2. Add an environment variable with `heroku config:set NODE_ENV=production -a eyewitness-ui`.
3. Add an environment variable with `heroku config:set PROVIDER_ID=default -a eyewitness-ui`.
4. Run `heroku domains:add eyewitness-ui.<DOMAIN_NAME> -a eyewitness-ui` replacing <DOMAIN_NAME> as appropriate.
5. Take note of the DNS target given to you by the previous command, e.g. "eyewitness-ui.sometest.com.herokudns.com".
6. Run `heroku container:push web -a eyewitness-ui` to deploy the read server.
7. Run `heroku dyno:resize hobby -a eyewitness-ui` to allow us to use SSL on the domain (costs apply, see Heroku pricing).

### Setup DNS
1. Add a CNAME DNS record to your domain "eyewitness-ui" which points to the DNS target given in the previous section.
2. Enable automatic SSL certificate management with `heroku certs:auto:enable -a eyewitness-ui`.
3. When the DNS has updated you should see some output by visiting `https://eyewitness-ui.<DOMAIN_NAME>/health-check` where <DOMAIN_NAME> is replaced with your domain.

## Deploying Updates
Every so often there may be updates to Eyewitness that you want to deploy. In that case follow these steps:

1. CD into the "eyewitness" or "eyewitness-ui" directory you created when you first deployed Eyewitness.
2. Run `git pull origin master` in the directory.
3. To redeploy the bot, run `heroku container:push web -a eyewitness-bot` in the "eyewitness" directory.
4. To redeploy the read server, run `heroku container:push web -a eyewitness-rs` in the "eyewitness" directory.
5. To redeploy the user interface, run `heroku container:push web -a eyewitness-ui` in the "eyewitness-ui" directory.
6. The services will reboot within a few minutes.
