/**
 * The reminder's long-press (canvas SX-14): a notification content extension for the "reading" category,
 * drawing the passage in Yada's serif (overline, name, reference, two BSB verses) above iOS's Read and Listen.
 * What it draws comes in the notification itself (modules/yada-system scheduleReminder), BSB only (rule 9).
 * Colours from src/design/palette.ts.
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = () => ({
  type: "notification-content",
  name: "YadaNotification",
  bundleIdentifier: ".notification",
  deploymentTarget: "16.4",
  frameworks: ["UserNotifications", "UserNotificationsUI", "SwiftUI"],
  colors: {
    ink: { light: "#16231E", dark: "#ECF0E4" },
    mutedInk: { light: "#526D63", dark: "#9AAFA4" },
  },
});
