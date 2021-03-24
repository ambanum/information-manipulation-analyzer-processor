FROM python:3.7-slim-stretch

# Create folder and user
RUN adduser ambnum && \
  chmod 777 /home/ambnum && \
  chown ambnum:ambnum /home/ambnum

# update package repositories
RUN apt-get update -y
RUN apt-get install -y python3-pip
RUN /usr/local/bin/python -m pip install --upgrade pip
RUN python -v

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

## install all packages even with dev dependencies to be able to launch typescript build
COPY package.json /home/ambnum
COPY yarn.lock /home/ambnum
RUN yarn

# install microservice code
COPY . /home/ambnum/
RUN yarn build
RUN chmod 777 /home/ambnum/build && \
  chown ambnum:ambnum /home/ambnum/build

# clean
RUN apt-get clean autoclean && \
  pip cache purge && \
  yarn cache clean && \
  rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

RUN chown -R ambnum:ambnum /home/ambnum

# Finally use right user
USER ambnum

# and install twint for this user specifically as it does not work else
RUN pip3 install --user --upgrade git+https://github.com/twintproject/twint.git@origin/master#egg=twint
RUN pip show twint | grep Version

CMD [ "yarn", "start" ]
