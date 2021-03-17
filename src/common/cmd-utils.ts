import * as logging from 'common/logging';

import { execSync } from 'child_process';

export const execCmd = (cmd: string): string => {
  logging.debug(`[CMD] ${cmd}`);
  const start = process.hrtime();

  // https://stackoverflow.com/questions/63796633/spawnsync-bin-sh-enobufs
  const result = execSync(cmd, { stdio: 'ignore' });

  const end = process.hrtime(start);
  logging.debug(`[CMD] Command completed in ${Number(end[1] / 1000000).toFixed(0)}ms`);

  return result && result.toString();
};
