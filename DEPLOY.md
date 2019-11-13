# EYEWITNESS DEPLOYMENT NOTES

**References to Heroku are now out of date as the new deployment is based on docker-compose, but this file left in place as it still contains some helpful info**

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
These are the environment variables you'll need to set on your Heroku apps for the bot and read server:

| Variable                     | Description |
|------------------------------|-------------|
| LOGGERS_TERMINAL_LEVEL       | The log level to use e.g. "verbose", "debug", "error", "info". |
| DB_MONGO_CONNECTION_STR      | The connection string to your MongoDB database. |
| ANALYTICS_DASHBOT_API_KEY    | Your API key for Dashbot analytics. |
| ANALYTICS_SEGMENT_WRITE_KEY  | Your write key for Segment analytics. |
| ADAPTER_FB_VERIFY_TOKEN      | A random string used to verify your webhook with your Facebook app. |
| ADAPTER_FB_ACCESS_TOKEN      | An access token generated when setting up your Facebook app. |
| ADAPTER_WEB_ACCESS_TOKEN     | A random string used to verify communications sent between your bot and the UI. |
| NLP_LUIS_DISABLED            | Set to "true" to disable NLP via LUIS. |
| NLP_LUIS_APP_ID              | Your LUIS app ID. |
| NLP_LUIS_API_KEY             | Your LUIS API key. |
| NLP_LUIS_APP_REGION          | The region where your LUIS app is hosted. |
| SERVER_URI_BOT               | The URL where your bot is hosted. |
| SERVER_URI_READ              | The URL where your read server is hosted. |
| SERVER_URI_UI                | The URL where your UI is hosted. |
| PROVIDER_ID                  | A short lowercase ID for the organisation's to use in domain names. |
| PROVIDER_NAME                | Your organisation's name or title. |
| PROVIDER_FEED_URI            | The URL to your RSS feed. |
| PROVIDER_TIMEZONE_OFFSET     | The number of hours difference between your timezone and UTC. |
| PROVIDER_ITEM_PRIORITY_FIELD | The field to use for "breaking news" in your RSS feed, e.g. "category" or "tags". |
| PROVIDER_ITEM_PRIORITY_VALUE | The value to find in your breaking news field, e.g. "breaking news". |
| GREETING_TEXT                | The text to display to new users visiting your bot for the first time before they send their first message. |
| PRIVACY_POLICY_URI           | Url to your privacy policy webpage. |

### Setup Heroku
1. Run `heroku login` to login to Heroku.
2. Run `heroku container:login` to login to the Heroku image repository.
3. Run `heroku create eyewitness-bot --region eu` to create an empty app on Heroku for the bot.
4. Add an environment variable with `heroku config:set NODE_ENV=production -a eyewitness-bot`.
5. Add an environment variable with `heroku config:set ENTRY_POINT=bot -a eyewitness-rs`.
6. Add all the environment variables listed in the `empty.env` file with the appropriate values for your deployment using the `heroku config:set` command (see `prepare the config` section above).
7. Run `heroku domains:add eyewitness-bot.<DOMAIN_NAME> -a eyewitness-bot` replacing <DOMAIN_NAME> as appropriate.
8. Take note of the DNS target given to you by the previous command, e.g. "eyewitness-bot.sometest.com.herokudns.com".
9. Run `heroku container:push web -a eyewitness-bot` to push the Docker image to Heroku.
10. Run `heroku container:release -a eyewitness-bot web` to deploy the bot.
11. Run `heroku dyno:resize hobby -a eyewitness-bot` to allow us to use SSL on the domain (costs apply, see Heroku pricing).
12. Enable automatic SSL certificate management with `heroku certs:auto:enable -a eyewitness-bot`.

### Setup DNS
1. Add a CNAME DNS record to your domain "eyewitness-bot" which points to the DNS target given in the previous section.
2. When the DNS has updated you should see some output by visiting `https://eyewitness-bot.<DOMAIN_NAME>/health-check` where <DOMAIN_NAME> is replaced with your domain.
3. In the Facebook app you created earlier, setup the webhook with the URL `https://eyewitness-bot.<DOMAIN_NAME>/api/adapter/facebook` and your verify token.

## Deploy the Read Server
The read server tracks how many times each story has been read and by which users.

### Setup Heroku
1. Run `heroku create eyewitness-rs --region eu` to create an empty app on Heroku for the read server.
2. Add an environment variable with `heroku config:set NODE_ENV=production -a eyewitness-rs`.
3. Add an environment variable with `heroku config:set ENTRY_POINT=read-server -a eyewitness-rs`.
4. Add all the environment variables listed in the `empty.env` file with the appropriate values for your deployment using the `heroku config:set` command (see `prepare the config` section above).
5. Run `heroku domains:add eyewitness-rs.<DOMAIN_NAME> -a eyewitness-rs` replacing <DOMAIN_NAME> as appropriate.
6. Take note of the DNS target given to you by the previous command, e.g. "eyewitness-rs.sometest.com.herokudns.com".
7. Run `heroku container:push web -a eyewitness-rs` to push the Docker image to Heroku.
8. Run `heroku container:release -a eyewitness-rs web` to deploy the read server.

### Setup DNS
1. Add a CNAME DNS record to your domain "eyewitness-rs" which points to the DNS target given in the previous section.
2. When the DNS has updated you should see some output by visiting `https://eyewitness-rs.<DOMAIN_NAME>/health-check` where <DOMAIN_NAME> is replaced with your domain.

## Deploy the User Interface
The user interface is used by admins to message users of the bot, manage the stories the bot sends out, and more.

### Prepare the Config
These are the environment variables you'll need to set on your Heroku apps for the bot and read server:

| Variable                 | Description |
|--------------------------|-------------|
| DB_MONGO_CONNECTION_STR  | The connection string to your MongoDB database. |
| AUTH_COOKIE_SECRET       | A random string used to sign the login cookie. |
| USER_PWD_BOT             | A password	for your bot to use to communicate with the UI. |
| USER_PWD_ADMIN           | A password for humans to use to login to the UI. |
| FB_PAGE_ID               | The ID or username of the Facebook page your bot is linked to. |
| UI_SERVER_URI            | The URL where your UI is hosted. |
| BOT_SERVER_URI           | The URL where your bot is hosted. |
| BOT_SERVER_ACCESS_TOKEN  | Must be the same random string you set in the ADAPTER_WEB_ACCESS_TOKEN environment variable for the bot. |
| AWS_S3_ACCESS_KEY_ID     | An AWS access key ID for an IAM user. |
| AWS_S3_SECRET_ACCESS_KEY | An AWS secret access key for an IAM user. |
| AWS_S3_REGION            | The region where your AWS S3 bucket is hosted. |
| AWS_S3_BUCKET            | The name of your AWS S3 bucket. |
| AWS_S3_KEY_PREFIX        | The key prefix to prepend to media filenames. |

### Setup Heroku
1. Run `heroku create eyewitness-ui --region eu` to create an empty app on Heroku for the user interface.
2. Add an environment variable with `heroku config:set NODE_ENV=production -a eyewitness-ui`.
3. Add all the environment variables listed in the `empty.env` file with the appropriate values for your deployment using the `heroku config:set` command (see `prepare the config` section above).
4. Run `heroku domains:add eyewitness-ui.<DOMAIN_NAME> -a eyewitness-ui` replacing <DOMAIN_NAME> as appropriate.
5. Take note of the DNS target given to you by the previous command, e.g. "eyewitness-ui.sometest.com.herokudns.com".
7. Run `heroku container:push web -a eyewitness-ui` to push the Docker image to Heroku.
8. Run `heroku container:release -a eyewitness-ui web` to deploy the UI.
7. Run `heroku dyno:resize hobby -a eyewitness-ui` to allow us to use SSL on the domain (costs apply, see Heroku pricing).
8. Enable automatic SSL certificate management with `heroku certs:auto:enable -a eyewitness-ui`.

### Setup DNS
1. Add a CNAME DNS record to your domain "eyewitness-ui" which points to the DNS target given in the previous section.
2. When the DNS has updated you should see some output by visiting `https://eyewitness-ui.<DOMAIN_NAME>/health-check` where <DOMAIN_NAME> is replaced with your domain.

## Deploying Updates
Every so often there may be updates to Eyewitness that you want to deploy. In that case follow these steps:

1. CD into the "eyewitness" or "eyewitness-ui" directory you created when you first deployed Eyewitness.
2. Run `git pull origin master` in the directory.
3. To redeploy the bot, run `heroku container:push web -a eyewitness-bot` in the "eyewitness" directory.
4. To redeploy the read server, run `heroku container:push web -a eyewitness-rs` in the "eyewitness" directory.
5. To redeploy the user interface, run `heroku container:push web -a eyewitness-ui` in the "eyewitness-ui" directory.
6. The services will reboot within a few minutes.
