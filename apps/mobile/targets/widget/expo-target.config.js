/**
 * The widget extension (canvas SX-01–09, SX-17–23): Continue and A passage for today in three sizes, the Lock
 * Screen accessories, StandBy, the Control Center controls (iOS 18) and the listening Live Activity with its
 * Dynamic Island. Every word it shows is one of the four open texts (rule 9), handed over by the app through
 * the App Group (modules/yada-system).
 * Colours from src/design/palette.ts.
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = () => ({
  type: "widget",
  name: "YadaWidget",
  bundleIdentifier: ".widget",
  deploymentTarget: "16.4",
  frameworks: ["SwiftUI", "WidgetKit", "ActivityKit", "AppIntents"],
  entitlements: { "com.apple.security.application-groups": ["group.studio.yada.reader"] },
  colors: {
    paper: { light: "#F7F8F0", dark: "#0E1814" },
    ink: { light: "#16231E", dark: "#ECF0E4" },
    mutedInk: { light: "#526D63", dark: "#9AAFA4" },
    accent: { light: "#183F35", dark: "#DBEC9A" },
    divider: { light: "#DFE5D7", dark: "#22332C" },
    selection: { light: "#E7EED8", dark: "#1A2D25" },
    // The Dynamic Island is black in either theme: its ring and figure take the dark accent.
    chartreuse: { light: "#DBEC9A", dark: "#DBEC9A" },
  },
});
