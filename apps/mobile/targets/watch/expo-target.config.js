/**
 * The Apple Watch app (canvas AW-01, AW-03): the day's verse and this part's psalms, and Sit with this on the wrist
 * (Settle, Breathe the verse, Silence). Its widgets are targets/watch-widget. What it shows comes from the iPhone
 * over WatchConnectivity (modules/yada-system WatchLink.swift), BSB only (rule 9). Listening is not here: the
 * watch's own Now Playing already follows the iPhone's reading (AW-02, free).
 * The watch is always dark: colours are src/design/palette.ts's dark ones.
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = () => ({
  type: "watch",
  name: "YadaWatch",
  displayName: "Yada",
  bundleIdentifier: ".watchkitapp",
  // watchOS 10: the Smart Stack and containerBackground (AW-01).
  deploymentTarget: "10.0",
  icon: "../../assets/brand/icon.png",
  frameworks: ["SwiftUI", "WatchConnectivity", "WidgetKit"],
  entitlements: { "com.apple.security.application-groups": ["group.studio.yada.reader"] },
  colors: {
    ink: "#F4F5F2",
    mutedInk: "#9C9F9B",
    accent: "#DBEC9A",
    card: "#171917",
  },
});
