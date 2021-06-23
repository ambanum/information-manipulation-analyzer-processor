# Information Manipulation Analyzer Processor

This is the processor of the "Information Manipulation Analyzer" project.

The main idea is to show the volumetry of a hashtag along with some other informations in order to have a better idea of whether or not a hashtag has been artificially improved.

The frontend that will actually log the hashtags to analyze and display the results can be found [here](https://github.com/ambanum/information-manipulation-analyzer)

## Technical stack

We are using now [Snscrape](https://github.com/JustAnotherArchivist/snscrape) to scrape all the data (twint has been abandoned due to some unstable requests).
Plan is to migrate Snscrape to the french sovereign bot whenever it will be ready.

We are also using a [Bot detection library](https://github.com/ambanum/social-networks-bot-finder) created by AmbNum and that needs to be installed

## Development

**IMPORTANT** main branch is `main` but all PRs must be against `develop`, except for immediate patches

Install mongoDB and lauch instance

```
brew tap mongodb/brew
brew install mongodb-community@4.4
mongo --version
brew services start mongodb-community
```

then install [mongoDB Compass](https://www.mongodb.com/products/compass) and create a local database

Create a `.env.local` file at the root of the project (You can copy it from `.env.local.example`)
and don't forget to change the name of your local database on the `MONGODB_URI` value

```
NODE_PATH="src"
MONGODB_URI="mongodb://localhost:27017/database-name?&compressors=zlib&retryWrites=true&w=majority"
```

Install snscrape

```
pip3 install git+https://github.com/JustAnotherArchivist/snscrape.git
```

Install jq

```
brew install jq
```

Then launch

```
yarn
yarn dev
```

## bot detection

In order to use the bot detection functionnality, you need to get a provider.

### social-networks-bot-finder

We have created an open source one which we can use. See [social-networks-bot-finder](https://github.com/ambanum/social-networks-bot-finder)

In order to impletement it you need to install it somewhere on your machine and add to `.env.local` two environment variables

```
BOT_SCORE_PROVIDER=social-networks-bot-finder
BOT_SCORE_SOCIAL_NETWORKS_PATH=~/Workspace/ambanum/social-networks-bot-finder/bot-finder.py
```

### PEReN webservice

Another provider that is available is the API of the PEReN for which you need an api key

In order to impletement it you need to add to `.env.local` two environment variables

```
BOT_SCORE_PROVIDER=peren
PEREN_API_KEY=XXXX
```

### soci

## Deployment

If you are part of `AmbNum`, you can use the deploy scripts in the `package.json`
