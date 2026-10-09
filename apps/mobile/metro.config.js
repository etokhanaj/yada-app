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

// packages/schema is TypeScript written for Node's ESM resolver, so its
// relative imports say "./refs.js" for refs.ts. The app now imports its runtime
// code (parseReference, morphLine, verseOrd), so Metro must map those back.
const packagesDir = path.resolve(workspaceRoot, "packages");
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolve ?? context.resolveRequest;
  if (moduleName.startsWith(".") && moduleName.endsWith(".js") && context.originModulePath.startsWith(packagesDir)) {
    try {
      return resolve(context, moduleName.slice(0, -3), platform);
    } catch {
      // Not a TypeScript sibling after all; resolve the name as written.
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
