#!/bin/bash

# An argument can be provided to deploy a specific service, otherwise all are deployed
OPTIONAL_SERVICE=$1

if [ -z "$NODE_ENV" ]; then
  echo "NODE_ENV must be set to 'staging' or 'production'. eg in '~/.profile' add the line: export NODE_ENV=staging";
else
  if [ "$NODE_ENV" = "staging" ]; then
    echo "Deploying staging environment...";
    docker-compose -f docker-compose.yml -f docker-compose.staging.yml up --force-recreate -d $OPTIONAL_SERVICE
  fi
  if [ "$NODE_ENV" = "production" ]; then
    echo "Deploying production environment...";
    docker-compose -f docker-compose.yml -f docker-compose.production.yml up --force-recreate -d $OPTIONAL_SERVICE
  fi
fi

