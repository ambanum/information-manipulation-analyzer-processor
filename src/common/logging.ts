import debugLib from 'debug';

export interface Logger {
  debug: (...args: any[]) => any;
  info: (...args: any[]) => any;
  warn: (...args: any[]) => any;
  error: (...args: any[]) => any;
}

const getTime = () => {
  const date = new Date();
  return `${date.getHours().toString().padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
};

export const debug = (...args: any[]) => debugLib('ima:debug')(`[${getTime()}]`, ...args);
// spaces are intended to align correclty logs in console
export const info = (...args: any[]) => console.log('ima: info', `[${getTime()}]`, ...args);
export const warn = (...args: any[]) => console.log('ima: warn', `[${getTime()}]`, ...args);
export const error = (...args: any[]) => console.log('ima:error', `[${getTime()}]`, ...args);

export const getLogger = (prefix?: string): Logger => {
  const getArgs = (...args) => (!!prefix ? [prefix, ...args] : [...args]);
  return {
    debug: (...args: any[]) => debug(...getArgs(...args)),
    info: (...args: any[]) => info(...getArgs(...args)),
    warn: (...args: any[]) => warn(...getArgs(...args)),
    error: (...args: any[]) => error(...getArgs(...args)),
  };
};
