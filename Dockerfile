# EYEWITNESS CHATBOT - PRODUCTION DOCKERFILE

# Use the official node base image and allow upgrades to any new minor version on redeploy.
FROM node:10
MAINTAINER Atchai <enquiries@atchai.com>
ENV NODE_ENV=production

# Prepare the software inside the container.
RUN apt-get update \
		&& apt-get upgrade -y \
		&& apt-get install -y \
      ntp \
    && rm -rf /var/lib/apt/lists/*
#      ^^ Keep the image size down by removing the packages list.

# Fix the time inside the container by starting the ntp service and setting the timezone.
RUN ntpd -gq && service ntp start
RUN echo Europe/London >/etc/timezone && dpkg-reconfigure -f noninteractive tzdata

# Ensure we run commands inside the correct directory.
WORKDIR /src

# Install our dependencies.
COPY .env /src/.env
COPY lib /src/lib
COPY package.json /src/package.json
COPY package-lock.json /src/package-lock.json
RUN npm install --production

# Add all our application files.
COPY app /src/app

# Run the application.
CMD ["npm", "run", "start-production"]
