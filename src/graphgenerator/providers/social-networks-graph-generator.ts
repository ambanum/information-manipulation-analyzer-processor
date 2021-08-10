import { Adapter } from '../index';
import { execCmd } from 'common/cmd-utils';
import fs from 'fs';
import temp from 'temp';

const GRAPH_GENERATOR_SOCIAL_NETWORKS_PATH =
  process.env.GRAPH_GENERATOR_SOCIAL_NETWORKS_PATH || 'graphgenerator';

export interface Graph {
  nodes: any[];
  edges: any[];
}

const getGraph: Adapter['getGraph'] = async (hashtag: string, options) => {
  let cmd: string;

  cmd = `${GRAPH_GENERATOR_SOCIAL_NETWORKS_PATH} "#${hashtag}"`;
  const result = execCmd(cmd);

  const graph: Graph = JSON.parse(result);

  return {
    graph,
  };
};

const getVersion: Adapter['getVersion'] = () => {
  const cmd = `${GRAPH_GENERATOR_SOCIAL_NETWORKS_PATH} --version`;
  return execCmd(cmd);
};

const adapter: Adapter = {
  getGraph,
  getVersion,
};

export default adapter;
