#!/bin/bash

# Can be used to pass --force-renew or another option
CERTBOT_OPTION=$1

# Renew all certificates (if necessary)
certbot renew $CERTBOT_OPTION
# Reload nginx without downtime
docker exec eyewitness-bot_nginx_bot_1 nginx -s reload
docker exec eyewitness-bot_nginx_read-server_1 nginx -s reload
docker exec eyewitness-ui_nginx_ui_1 nginx -s reload

