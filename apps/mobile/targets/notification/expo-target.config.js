/**
 * The reminder's long-press (canvas SX-14): a notification content extension for the "reading" category,
 * drawing the passage in Yada's serif (overline, name, reference, two BSB verses) above iOS's Read and Listen.
 * What it draws comes in the notification itself (modules/yada-system scheduleReminder), BSB only (rule 9).
 * Colours from src/design/palette.ts (design QA X2: these were still the chalk ones); the serif is Literata, bundled
 * here as in the widget. src/lib/systemSurfaces.files.test.ts fails when the colours drift.
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = () => ({
  type: "notification-content",
  name: "YadaNotification",
  bundleIdentifier: ".notification",
  deploymentTarget: "16.4",
  frameworks: ["UserNotifications", "UserNotificationsUI", "SwiftUI"],
  colors: {
    ink: { light: "#111311", dark: "#F4F5F2" },
    mutedInk: { light: "#686B69", dark: "#9C9F9B" },
  },
});
