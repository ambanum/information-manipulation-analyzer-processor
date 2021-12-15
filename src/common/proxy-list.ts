import axios from 'axios';

const random = (mn: number, mx: number) => Math.random() * (mx - mn) + mn;
const arrayRandom = <T>(array: T[]) => array[Math.floor(random(1, array.length)) - 1];

export interface Proxy {
  url: string;
  host: string;
  port: string;
}

export default class ProxyList {
  public proxies: Proxy[];
  // https://github.com/clarketm/proxy-list
  public static url =
    'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt';

  static async getProxies() {
    let proxies: Proxy[] = [];

    try {
      const { data } = await axios.get<string>(ProxyList.url);

      const match = data.match(/\d+\.\d+\.\d+\.\d+:\d+/gim);
      if (match) {
        proxies = match.map((proxy) => ({
          url: `http://${proxy}`,
          host: proxy.split(':')[0],
          port: proxy.split(':')[1],
        }));
      }
    } catch (e: any) {
      console.error('Could not get proxies', e.toString());
    }

    return proxies;
  }

  static async getInstance() {
    const proxies = await ProxyList.getProxies();
    return new ProxyList(proxies);
  }

  constructor(proxies) {
    this.proxies = proxies;
  }

  async retryWithProxy(
    func: (proxy: Proxy) => Promise<any>,
    removeProxyCondition?: (error: any) => boolean,
    retry = 3
  ) {
    const proxy = this.getRandom();
    try {
      await func(proxy);
    } catch (e: any) {
      if (!removeProxyCondition || (removeProxyCondition && removeProxyCondition(e))) {
        this.remove(proxy);
      }

      if (retry >= 0) {
        console.log(`Retrying - ${retry} left`);
        return this.retryWithProxy(func, removeProxyCondition, retry - 1);
      }
      throw e;
    }
  }

  remove(proxy: Proxy) {
    this.proxies = this.proxies.filter((p) => p.url !== proxy.url);
    console.log(`Removed proxy ${proxy.url} - ${this.proxies.length} left`);
  }

  getRandom() {
    return arrayRandom<Proxy>(this.proxies) || ({} as Proxy);
  }
}
