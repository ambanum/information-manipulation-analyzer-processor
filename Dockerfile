FROM python:3.8-slim

EXPOSE 4000

ARG ENV_FILE=".env.production"

# Create folder and user
RUN adduser ambnum && \
    chmod 777 /home/ambnum && \
    chown ambnum:ambnum /home/ambnum

# update package repositories
RUN apt-get update -y
RUN apt-get install -y python3-pip python3-numpy
RUN pip install --upgrade pip setuptools wheel numpy

# install common useful libs for debugging
RUN apt-get install -y nano git

# install lib to prevent error "spawn ps ENOENT" when launching docker
RUN apt-get install -y procps

# install libs to use within the processor
RUN apt-get install -y jq

# install specific version of node
RUN apt-get install -y curl \
    && curl -sL https://deb.nodesource.com/setup_14.x | bash - \
    && apt-get install -y nodejs \
    && npm i -g yarn

# install code
WORKDIR /home/ambnum
ENV NODE_ENV=production
ENV NODE_OPTIONS='--max_old_space_size=4096'

## install all packages even with dev dependencies to be able to launch typescript build
COPY package.json /home/ambnum
COPY yarn.lock /home/ambnum
RUN yarn

# install microservice code
COPY . /home/ambnum/
RUN rm .env.*
COPY ./docker/$ENV_FILE /home/ambnum/.env.production

# For local build until I understand how to make a conditional RUN in docker
# COPY ./$ENV_FILE /home/ambnum/.env.production

RUN yarn build
RUN chmod 777 /home/ambnum/build && \
    chown ambnum:ambnum /home/ambnum/build
RUN pip install social-networks-bot-finder==1.2.3
# this next line is here to break the build in case botfinder does not work
RUN botfinder -v

# clean
RUN apt-get clean autoclean && \
    pip cache purge && \
    yarn cache clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

RUN chown -R ambnum:ambnum /home/ambnum

# Finally use right user
USER ambnum

WORKDIR /home/ambnum

# and install scraper for this user specifically as it does not work else
# RUN pip3 install --user --upgrade "git+https://github.com/ambanum/twint.git@origin/master#egg=twint"
# use this commit as next breaks with  missing 1 required positional argument: 'thumbnailUrl'
RUN pip3 install git+https://github.com/JustAnotherArchivist/snscrape.git@a192dc62368685fe4cd2229ab93a0babf8ad901a

ENV PATH="/home/ambnum/.local/bin:${PATH}"

CMD [ "yarn", "start" ]
