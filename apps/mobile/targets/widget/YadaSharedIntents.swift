// The intents a widget, a Live Activity or a control runs (SX-05, SX-07, SX-09, SX-17). Each must be compiled
// into both the widget extension, which draws the button, and the app, where iOS performs it: this file is
// copied into the app target at prebuild (plugins/withAppIntents.js) and kept identical to
// targets/widget/YadaSharedIntents.swift (systemSurfaces.files.test.ts).

import AppIntents
import Foundation

/// The App Group the app and the widgets share (the reminder's long-press needs none: it draws from the notification).
let yadaGroup = "group.studio.yada.reader"

/// A door into the app (IA-13), handed to the YadaSystem module: kept in the App Group until JS takes it, and
/// announced across processes, so whichever process iOS runs the intent in, a running app takes it at once.
enum Door {
  static let key = "yada.pendingOpen"
  static let announce = "studio.yada.reader.open"

  static func open(_ door: String) {
    UserDefaults(suiteName: yadaGroup)?.set(door, forKey: key)
    CFNotificationCenterPostNotification(CFNotificationCenterGetDarwinNotifyCenter(), CFNotificationName(announce as CFString), nil, nil, true)
  }
}

/// What plays, as the app last wrote it (lib/systemSurfaces.ts ListeningData); nil when nothing does.
struct Listening: Codable, Hashable, Sendable {
  let book: String
  let chapter: Int
  let verse: Int
  /// "John 1:5".
  let ref: String
  let playing: Bool

  static let key = "listening"

  static func raw() -> String { UserDefaults(suiteName: yadaGroup)?.string(forKey: key) ?? "" }

  static func load() -> Listening? {
    guard let data = raw().data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(Listening.self, from: data)
  }

  /// Until the app says what plays now, or a few seconds pass: an audio intent that returns before playback
  /// starts may see its background launch suspended.
  static func awaitChange(from before: String, seconds: Double = 8) async {
    let end = Date().addingTimeInterval(seconds)
    while Date() < end, raw() == before {
      try? await Task.sleep(nanoseconds: 250_000_000)
    }
  }
}

/// Previous, play or pause, next from the Lock Screen, the Dynamic Island and StandBy (SX-17–22): the app runs
/// it, and the reading queue takes it as it takes the headphone controls (data/audio.ts remoteCommand).
@available(iOS 17.0, *)
struct YadaControlIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Control the reading"
  static var isDiscoverable = false

  @Parameter(title: "Command") var command: String

  init() {}
  init(command: String) { self.command = command }

  func perform() async throws -> some IntentResult {
    NotificationCenter.default.post(name: Notification.Name("YadaRemoteControl"), object: nil, userInfo: ["command": command])
    return .result()
  }
}

/// SX-05, SX-07: Listen on a widget plays without opening Yada; pressed again, it pauses. `what` is "today"
/// (today's psalm) or "continue" (the place).
@available(iOS 17.0, *)
struct ListenIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Listen"
  static var isDiscoverable = false

  @Parameter(title: "What") var what: String

  init() {}
  init(what: String) { self.what = what }

  func perform() async throws -> some IntentResult {
    let before = Listening.raw()
    Door.open("listen:\(what)")
    await Listening.awaitChange(from: before)
    return .result()
  }
}

/// "Continue reading" (SX-11) and Control Center's Continue (SX-09): the reader at the place.
@available(iOS 16.0, *)
struct ContinueReadingIntent: AppIntent {
  static var title: LocalizedStringResource = "Continue reading"
  static var description = IntentDescription("Opens Yada where you are reading.")
  static var openAppWhenRun = true
  init() {}

  @MainActor
  func perform() async throws -> some IntentResult {
    Door.open("continue")
    return .result()
  }
}

/// SX-09: Control Center's Listen, a toggle; on, it plays where you are, off, it pauses.
@available(iOS 18.0, *)
struct ListenToggleIntent: SetValueIntent, AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Listen"
  static var isDiscoverable = false

  @Parameter(title: "Listening") var value: Bool

  init() {}

  func perform() async throws -> some IntentResult {
    let before = Listening.raw()
    Door.open(value ? "listen:continue" : "pause")
    await Listening.awaitChange(from: before)
    return .result()
  }
}
