FROM python:3.7-slim-stretch

# Create folder and user
RUN adduser ambnum && \
  chmod 777 /home/ambnum && \
  chown ambnum:ambnum /home/ambnum

# update package repositories
RUN apt-get update -y
RUN /usr/local/bin/python -m pip install --upgrade pip
RUN python -v

# install common useful libs for debugging
RUN apt-get install -y nano

# install twint
RUN pip3 install twint
RUN pip show twint | grep Version

# install specific version of node
RUN apt-get install -y curl \
  && curl -sL https://deb.nodesource.com/setup_14.x | bash - \
  && apt-get install -y nodejs \
  && npm i -g yarn

# install code
WORKDIR /home/ambnum
ENV NODE_ENV=production

## install all packages even with dev dependencies
COPY package.json /home/ambnum
COPY yarn.lock /home/ambnum
RUN yarn

# install microservice code
COPY . /home/ambnum/
RUN yarn build
RUN chmod 777 /home/ambnum/build && \
  chown ambnum:ambnum /home/ambnum/build

# clean
RUN apt-get clean
RUN pip cache purge
RUN yarn cache clean
RUN rm -rf /tmp/*

# Finally use right user
USER ambnum


CMD [ "yarn", "start" ]
