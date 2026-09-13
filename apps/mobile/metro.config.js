// Monorepo Metro config: the app imports golden fixtures from the repo root,
// so the workspace root has to be watched and resolvable.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

// Bundles are prebuilt SQLite files shipped as assets (build plan §4). Without
// this, Metro refuses to resolve require("…/core.v1.db").
config.resolver.assetExts = [...config.resolver.assetExts, "db"];

module.exports = config;
