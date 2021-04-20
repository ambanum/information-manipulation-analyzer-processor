# Information Manipulation Analyzer Processor

This is the processor of the "Information Manipulation Analyzer" project.

The main idea is to show the volumetry of a hashtag along with some other informations in order to have a better idea of whether or not a hashtag has been artificially improved.

The frontend that will actually log the hashtags to analyze and display the results can be found [here](https://github.com/ambanum/information-manipulation-analyzer)

## Technical stack

We are using now [Snscrape](https://github.com/JustAnotherArchivist/snscrape) to scrape all the data (twint has been abandoned due to some unstable requests).
Plan is to migrate Snscrape to the french sovereign bot whenever it will be ready

## Development

**IMPORTANT** main branch is `main` but all PRs must be against `develop`, except for immediate patches

Create a `.env.local` file at the root of the project (You can copy it from `.env.local.example`)

```
NODE_PATH="src"
MONGODB_URI="mongodb://localhost:27017/information-manipulation-analyzer-preproduction?&compressors=zlib&retryWrites=true&w=majority"
```

launch a mongoDb Instance or connect to a distant one

Then launch

```
yarn
yarn dev
```

## Deployment

If you are part of `AmbNum`, you can use the deploy scripts in the `package.json`
