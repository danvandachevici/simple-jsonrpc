FROM node:6.10.2

# Create app directory
RUN mkdir -p /usr/src/app/lib
RUN mkdir -p /usr/src/app/test
WORKDIR /usr/src/app

# Install app dependencies
# COPY package.json /usr/src/app/
# RUN apt-get update; npm install

# Bundle app source
COPY ./index.js /usr/src/app/
ADD lib/ /usr/src/app/lib
ADD test/ /usr/src/app/test

# RUN npm test
