import { Adapter } from '../index';
import ogScraper from 'open-graph-scraper';
import { version } from 'open-graph-scraper/package.json';

export interface Media {
  url: string;
  width: string;
  height: string;
  type?: any;
}

export interface OGSData {
  ogSiteName: string;
  ogUrl: string;
  ogTitle: string;
  ogDescription: string;
  alIosAppStoreId: string;
  alIosAppName: string;
  alIosUrl: string;
  alAndroidUrl: string;
  alWebUrl: string;
  ogType: string;
  alAndroidAppName: string;
  alAndroidPackage: string;
  twitterCard: string;
  twitterSite: string;
  twitterUrl: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterAppNameiPhone: string;
  twitterAppIdiPhone: string;
  twitterAppNameiPad: string;
  twitterAppIdiPad: string;
  twitterAppUrliPhone: string;
  twitterAppUrliPad: string;
  twitterAppNameGooglePlay: string;
  twitterAppIdGooglePlay: string;
  twitterAppUrlGooglePlay: string;
  ogImage: Media;
  ogVideo: Media;
  twitterImage: Media;
  twitterPlayer: Media;
  requestUrl: string;
  success: true;
}

const getUrlData: Adapter['getUrlData'] = async (url, options) => {
  const allOptions = {
    url,
    ...options,
  };
  const { result } = await ogScraper(allOptions);

  const title = result?.title || result?.ogTitle || result?.twitterTitle;
  const description = result?.description || result?.ogDescription || result?.twitterDescription;
  const image = result?.image || result?.ogImage || result?.twitterImage;
  const video = result?.video || result?.ogVideo || result?.twitterVideo;
  const site =
    result?.ogSiteName ||
    result?.alAndroidAppName ||
    result?.alIosAppName ||
    result?.twitterAppNameiPhone ||
    result?.twitterSite;
  const publishedAt = result?.articlePublishedTime;
  const author = result?.author;
  const authorUrl = result?.articleAuthor;

  return {
    ...(image ? { image } : {}),
    ...(video ? { video } : {}),
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(site ? { site } : {}),
    ...(publishedAt ? { publishedAt } : {}),
    ...(author ? { author } : {}),
    ...(authorUrl ? { authorUrl } : {}),
    scrapedAt: new Date(),
    version,
  };
};

const adapter: Adapter = {
  getUrlData,
  getVersion: () => version,
};

export default adapter;
