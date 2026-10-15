/**
 * Adds modules/yada-system/app/*.swift to the app target at prebuild. App Intents (Siri, App Shortcuts,
 * the Live Activity's controls; MS-02, MS-03, WL-02) are found only in the app's own sources: compiled
 * into the YadaSystem pod, a static library, Siri never sees them.
 */

const fs = require("node:fs");
const path = require("node:path");
const { withXcodeProject, IOSConfig } = require("expo/config-plugins");

module.exports = function withAppIntents(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const root = cfg.modRequest.projectRoot;
    const name = IOSConfig.XcodeUtils.getProjectName(root);
    const source = path.join(root, "modules", "yada-system", "app");
    const dest = path.join(cfg.modRequest.platformProjectRoot, name);
    for (const file of fs.readdirSync(source).filter((f) => f.endsWith(".swift"))) {
      fs.copyFileSync(path.join(source, file), path.join(dest, file));
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath: path.join(name, file), groupName: name, project });
    }
    return cfg;
  });
};
