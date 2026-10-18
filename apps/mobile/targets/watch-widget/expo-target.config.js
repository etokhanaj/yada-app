/**
 * The watch's widgets (canvas AW-01): Today in the Smart Stack, and the same widget on a watch face as a
 * rectangular complication (Today, the psalms, the verse's reference) or the Yada mark in a circle; and This
 * morning's psalms on their own. They read what the watch app saved from the iPhone (targets/watch), BSB only
 * (rule 9). Colours are src/design/palette.ts's dark ones.
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = () => ({
  type: "watch-widget",
  name: "YadaWatchWidget",
  displayName: "Yada",
  // A watch extension's identifier starts with its watch app's.
  bundleIdentifier: ".watchkitapp.widget",
  deploymentTarget: "10.0",
  frameworks: ["SwiftUI", "WidgetKit"],
  entitlements: { "com.apple.security.application-groups": ["group.studio.yada.reader"] },
  colors: {
    ink: "#F4F5F2",
    mutedInk: "#9C9F9B",
    accent: "#DBEC9A",
    card: "#171917",
  },
});
