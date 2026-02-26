import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { setupWSConnection, docs, getYDoc } = require('y-websocket/bin/utils');

export { setupWSConnection, docs, getYDoc };
