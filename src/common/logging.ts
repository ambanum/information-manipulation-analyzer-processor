import debugLib from 'debug';

export const debug = debugLib('ima:debug');
// spaces are intended to align correclty logs in console
export const info = debugLib('ima: info');
export const warn = debugLib('ima: warn');
export const error = debugLib('ima: error');
