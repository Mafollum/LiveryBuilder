// Copies the current build (out/) into windows/app, the folder that "Start LiveryBuilder.bat" runs.
// Usage: npm run pack:windows   (builds first)
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'windows', 'app');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

rmSync(app, { recursive: true, force: true });
mkdirSync(app, { recursive: true });
cpSync(join(root, 'out'), join(app, 'out'), { recursive: true });
writeFileSync(
  join(app, 'package.json'),
  JSON.stringify({ name: pkg.name, productName: pkg.productName, version: pkg.version, private: true, main: 'out/main/index.js' }, null, 2) + '\n',
);
console.log(`windows/app updated from out/ (version ${pkg.version})`);
