import debugLib from 'debug';

const getTime = () => {
  const date = new Date();
  return `${date.getHours().toString().padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
};

export const debug = (...args: any[]) => debugLib('ima:debug')(`[${getTime()}]`, ...args);
// spaces are intended to align correclty logs in console
export const info = (...args: any[]) => debugLib('ima: info')(`[${getTime()}]`, ...args);
export const warn = (...args: any[]) => debugLib('ima: warn')(`[${getTime()}]`, ...args);
export const error = (...args: any[]) => debugLib('ima: error')(`[${getTime()}]`, ...args);
