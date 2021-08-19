import ogScraper from './providers/open-graph-scraper';
const URL_SCRAPER_PROVIDER = 'open-graph-scraper';

export interface UrlScraperResponse {
  title?: string;
  description?: string;
  site?: string;
  author?: string;
  authorUrl?: string;
  image?: {
    url: string;
    width: string;
    height: string;
    type?: string;
  };
  video?: {
    url: string;
    width: string;
    height: string;
    type?: string;
  };
  version?: string;
  scrapedAt: Date;
}

export interface GetUrlScraperOptions {}

export interface Adapter {
  getUrlData: (url: string, options?: GetUrlScraperOptions) => Promise<UrlScraperResponse>;
  getVersion: () => string;
}

const adapter: Adapter =
  URL_SCRAPER_PROVIDER === 'open-graph-scraper' ? ogScraper : ({} as Adapter);

export const getUrlData = async (url: string, options: GetUrlScraperOptions = {}) =>
  adapter ? adapter.getUrlData(url, options) : {};

export const getVersion = () => (adapter ? adapter.getVersion() : '');
export const getProvider = () => URL_SCRAPER_PROVIDER;
