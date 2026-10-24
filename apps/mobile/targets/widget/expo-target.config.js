/**
 * The widget extension (canvas SX-01–09): Continue and A passage for today in three sizes, the Lock Screen
 * accessories, StandBy and the Control Center controls (iOS 18). Every word it shows is one of the four open texts (rule 9), handed over by the app through
 * the App Group (modules/yada-system).
 * Colours from src/design/palette.ts, the white palette of the 15 Oct polish (design QA X1: these were still the
 * chalk ones); src/lib/systemSurfaces.files.test.ts fails when the two drift.
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = () => ({
  type: "widget",
  name: "YadaWidget",
  bundleIdentifier: ".widget",
  deploymentTarget: "16.4",
  frameworks: ["SwiftUI", "WidgetKit", "AppIntents"],
  entitlements: { "com.apple.security.application-groups": ["group.studio.yada.reader"] },
  colors: {
    paper: { light: "#FFFFFF", dark: "#0B0C0B" },
    ink: { light: "#111311", dark: "#F4F5F2" },
    mutedInk: { light: "#686B69", dark: "#9C9F9B" },
    accent: { light: "#183F35", dark: "#DBEC9A" },
    divider: { light: "#E9E9E7", dark: "#262826" },
    selection: { light: "#EEF3E4", dark: "#1C2418" },
  },
});
