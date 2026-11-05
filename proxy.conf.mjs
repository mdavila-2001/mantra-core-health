/** Proxy de desarrollo contra servicios reales; la demo agrega sus medios aparte. */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const base = require('./proxy.conf.json');

export default [...base];
