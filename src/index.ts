// @ts-ignore
import packageJson from '../package.json';

const { version } = packageJson;

(async () => {
  console.log(`Launching procesor in version ${version}`);
})();
