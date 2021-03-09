import debugLib from 'debug';

export const debug = debugLib('debug');
// spaces are intended to align correclty logs in console
export const info = debugLib(' info');
export const warn = debugLib(' warn');
export const error = debugLib(' error');
