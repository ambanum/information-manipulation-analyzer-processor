FROM python:3.9-slim

EXPOSE 4000

ARG ENV_FILE=".env.production"

# Create folder and user
RUN adduser ambnum && \
    chmod 777 /home/ambnum && \
    chown ambnum:ambnum /home/ambnum

# update package repositories
RUN apt-get update -y
RUN apt-get install -y python3-pip python3-numpy
RUN pip install --upgrade pip setuptools wheel
RUN pip install numpy

# install common useful libs for debugging
RUN apt-get install -y nano git

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
RUN yarn build
RUN chmod 777 /home/ambnum/build && \
    chown ambnum:ambnum /home/ambnum/build

RUN pip install social-networks-bot-finder==1.2.0

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
RUN pip3 install git+https://github.com/JustAnotherArchivist/snscrape.git

ENV PATH="/home/ambnum/.local/bin:${PATH}"

CMD [ "yarn", "start" ]
