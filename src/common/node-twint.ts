import { execCmd } from 'common/cmd-utils';

export const getVersion = () => {
  return execCmd('pip show twint | grep Version');
};
