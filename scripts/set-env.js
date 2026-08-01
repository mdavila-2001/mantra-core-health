const { writeFileSync, mkdirSync, existsSync } = require('fs');
const { join } = require('path');
require('dotenv').config();

const targetDir = join(__dirname, '../src/environments');

if (!existsSync(targetDir)) {
  mkdirSync(targetDir, { recursive: true });
}

const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';

const envConfigFile = `// Auto-generated script from scripts/set-env.js
import type { Environment } from './environment.types';

export const environment: Environment = {
  apiBaseUrl: '${apiBaseUrl}',
};
`;

const devEnvConfigFile = `// Auto-generated script from scripts/set-env.js
import type { Environment } from './environment.types';

export const environment: Environment = {
  apiBaseUrl: '${apiBaseUrl}',
};
`;

writeFileSync(join(targetDir, 'environment.ts'), envConfigFile);
writeFileSync(join(targetDir, 'environment.development.ts'), devEnvConfigFile);

console.log('[set-env] Environment files generated successfully with API_BASE_URL:', apiBaseUrl);
