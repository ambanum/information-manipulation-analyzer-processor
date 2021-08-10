import graphGenerator from './providers/social-networks-graph-generator';

export interface ProviderResponse {
  graph?: any;
}

export interface GraphGeneratorResponse {
  graphUrl?: string;
  graphUpdatedAt?: Date | string;
  graphProvider?: string;
  graphMetadata?: any;
}

export interface GetGraphGeneratorOptions {
  rawJson?: string;
}

export interface Adapter {
  getGraph: (hashtag: string, options?: GetGraphGeneratorOptions) => Promise<ProviderResponse>;
  getVersion: () => string;
}

const GRAPH_GENERATOR_PROVIDER = process.env.GRAPH_GENERATOR_PROVIDER;

const adapter: Adapter =
  GRAPH_GENERATOR_PROVIDER === 'social-networks-graph-generator' ? graphGenerator : ({} as Adapter);

export const getGraph = async (
  username: string,
  options: GetGraphGeneratorOptions = {}
): Promise<GraphGeneratorResponse> => {
  if (!adapter) {
    return {
      graphUrl: '',
    };
  }
  const { graph } = await adapter.getGraph(username, options);
  console.log(''); //eslint-disable-line
  console.log('╔════START══graph══════════════════════════════════════════════════'); //eslint-disable-line
  console.log(graph); //eslint-disable-line
  console.log('╚════END════graph══════════════════════════════════════════════════'); //eslint-disable-line

  return { graphUrl: '' };
};

export const getVersion = () => {
  if (!adapter) {
    return '';
  }

  return adapter.getVersion();
};

export const getProvider = () => GRAPH_GENERATOR_PROVIDER;
