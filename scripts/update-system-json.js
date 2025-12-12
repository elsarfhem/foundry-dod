const fs = require('fs');
const path = require('path');

/**
 * Semantic Release plugin to update system.json with download URL
 */
const prepare = async (pluginConfig, context) => {
  const {
    nextRelease: { version },
    cwd,
  } = context;

  const systemJsonPath = path.join(cwd, 'system.json');
  const systemJson = JSON.parse(fs.readFileSync(systemJsonPath, 'utf8'));

  // Update download URL with new version
  systemJson.download = `https://github.com/elsarfhem/foundry-dod/releases/download/v${version}/dod.zip`;

  // Update version field
  systemJson.version = version;

  // Write updated system.json
  fs.writeFileSync(systemJsonPath, JSON.stringify(systemJson, null, 2) + '\n');

  context.logger.log(`Updated system.json with version ${version}`);
};

module.exports = { prepare };

