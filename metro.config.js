const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const projectRoot = __dirname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const existing = config.resolver.blockList;
// Local inspection copies contain another package.json; keep generated artifacts out of Metro.
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  new RegExp(`^${projectRoot}[/\\\\](?:output|dist|\\.codex-tmp)[/\\\\]`),
];

module.exports = config;
