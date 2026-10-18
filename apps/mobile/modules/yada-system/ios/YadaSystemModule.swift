// The system surfaces (canvas SX-01–23): what the widgets, accessories and controls show, the listening Live
// Activity, the reminder with its long-press, BSB verses and chapters in Spotlight, and the doors Siri, App
// Shortcuts, widget buttons and Spotlight open into the app (IA-13). Every word that leaves the app here is one
// of the four open texts, gated in JS by lib/systemSurfaces.ts maySurfaceText (rule 9).

import ActivityKit
import CoreSpotlight
import ExpoModulesCore
import UserNotifications
import WidgetKit

/// Shared with the widget extension (targets/widget) and the reminder's long-press (targets/notification).
let appGroup = "group.studio.yada.reader"
/// A door from outside that opens the app: kept until JS asks, so a cold launch does not lose it. In the App
/// Group, as YadaSharedIntents.swift Door writes it from whichever process iOS runs the intent in.
let pendingKey = "yada.pendingOpen"
let doorAnnounce = "studio.yada.reader.open"
/// The reminder's notifications (SX-15): one thread, so iOS stacks them.
let reminderThread = "reminder"
/// Each chapter's first passage name, "PSA.23" → "The Lord is my shepherd", for Siri's card (YadaIntents.swift).
let chapterNamesKey = "yada.chapterNames"
/// Widget kinds whose Listen button follows what plays.
let listeningKinds = ["continue", "today", "listen"]

public class YadaSystemModule: Module {
  private var observer: NSObjectProtocol?
  private var turn: Task<Void, Never>?
  private let turnLock = NSLock()
  private var watchingDoors = false

  /// Runs `work` after every call queued before it.
  private func inTurn(_ work: @escaping () async -> Void) async {
    turnLock.lock()
    let previous = turn
    let task = Task {
      await previous?.value
      await work()
    }
    turn = task
    turnLock.unlock()
    await task.value
  }

  fileprivate func doorArrived() {
    // The key stays until JS takes it (takePendingOpen): on a cold launch JS is not listening yet, and an
    // event nobody hears is dropped (review, 13 Oct 2026).
    guard UserDefaults(suiteName: appGroup)?.string(forKey: pendingKey) != nil else { return }
    sendEvent("onOpen", [:])
  }

  public func definition() -> ModuleDefinition {
    Name("YadaSystem")
    Events("onOpen", "onControl")

    OnCreate {
      self.observer = NotificationCenter.default.addObserver(forName: Notification.Name("YadaRemoteControl"), object: nil, queue: .main) { [weak self] note in
        guard let command = note.userInfo?["command"] as? String else { return }
        self?.sendEvent("onControl", ["command": command])
      }
      // A door an intent opened, in this process or the widget extension's.
      CFNotificationCenterAddObserver(
        CFNotificationCenterGetDarwinNotifyCenter(),
        Unmanaged.passUnretained(self).toOpaque(),
        { _, observer, _, _, _ in
          guard let observer else { return }
          let module = Unmanaged<YadaSystemModule>.fromOpaque(observer).takeUnretainedValue()
          DispatchQueue.main.async { module.doorArrived() }
        },
        doorAnnounce as CFString,
        nil,
        .deliverImmediately
      )
      self.watchingDoors = true
    }

    OnDestroy {
      if let o = self.observer { NotificationCenter.default.removeObserver(o) }
      if self.watchingDoors {
        CFNotificationCenterRemoveEveryObserver(CFNotificationCenterGetDarwinNotifyCenter(), Unmanaged.passUnretained(self).toOpaque())
      }
    }

    /// The door that opened the app, once: a cold launch from Siri, a shortcut, a widget button or Spotlight.
    Function("takePendingOpen") { () -> String? in
      let shared = UserDefaults(suiteName: appGroup)
      let url = shared?.string(forKey: pendingKey)
      shared?.removeObject(forKey: pendingKey)
      return url
    }

    /// SX-01–08: the place and today's psalm, as JSON the widgets decode; then they draw again.
    Function("setWidgetData") { (json: String) in
      UserDefaults(suiteName: appGroup)?.set(json, forKey: "widget")
      WidgetCenter.shared.reloadAllTimelines()
    }

    /// AW-01, AW-03: the watch's mornings and evenings (WatchLink.swift).
    Function("setWatchData") { (json: String) in
      WatchLink.shared.send(json)
    }

    /// SX-05, SX-09: what plays, for the Listen buttons and Control Center's toggle. While audio plays, iOS does
    /// not count these reloads against the widgets' budget.
    Function("setListening") { (json: String) in
      let shared = UserDefaults(suiteName: appGroup)
      if json.isEmpty { shared?.removeObject(forKey: "listening") } else { shared?.set(json, forKey: "listening") }
      for kind in listeningKinds { WidgetCenter.shared.reloadTimelines(ofKind: kind) }
      if #available(iOS 18.0, *) { ControlCenter.shared.reloadControls(ofKind: "studio.yada.reader.listen") }
    }

    // One at a time: two quick calls (loading, then playing) must not both request an activity, nor an
    // end overtake a start (review, 13 Oct 2026). Each waits for the one before it.
    AsyncFunction("startReading") { (json: String) in
      guard let data = json.data(using: .utf8), let state = try? JSONDecoder().decode(ReadingAttributes.ContentState.self, from: data) else { return }
      await self.inTurn {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        if let current = Activity<ReadingAttributes>.activities.first {
          await current.update(ActivityContent(state: state, staleDate: nil))
          return
        }
        _ = try? Activity.request(attributes: ReadingAttributes(), content: ActivityContent(state: state, staleDate: nil))
      }
    }

    /// The reading ended (Stop listening, the end of the book, an app killed mid-session): its activity goes at once.
    /// A stop that fires does not come here: the activity stays paused on "Stopped after 1:18" (SX-23).
    AsyncFunction("endReading") {
      await self.inTurn {
        for activity in Activity<ReadingAttributes>.activities {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
    }

    /// MS-02: BSB verses, so "john 3 16" in Spotlight finds the verse. Called in batches; ids are verse ids.
    AsyncFunction("indexVerses") { (items: [[String: String]]) in
      try await CSSearchableIndex.default().indexSearchableItems(Self.searchable(items, prefix: "verse:", rank: 0))
    }

    /// SX-12: each chapter, ranked above its verses, so "psalm 23" has the psalm as its top hit: its first passage's
    /// name, then its first verse. The names are kept in the App Group for Siri's card (SX-10). From iOS 18 the app
    /// target indexes each chapter as an App Entity instead (YadaIntents.swift), which is what puts Read and Listen
    /// beside the hit; a plain item can carry no actions.
    AsyncFunction("indexChapters") { (items: [[String: String]]) in
      let shared = UserDefaults(suiteName: appGroup)
      var names = shared?.dictionary(forKey: chapterNamesKey) as? [String: String] ?? [:]
      for item in items { if let id = item["id"], let name = item["name"], !name.isEmpty { names[id] = name } }
      shared?.set(names, forKey: chapterNamesKey)
      // Awaited, so a failure reaches data/system.ts and the index is not recorded as done; it was fire-and-forget,
      // and a failed batch left chapters out of Spotlight until the next core (native review, 18 Oct 2026).
      if #available(iOS 18.0, *), let indexer = NSClassFromString("YadaShortcutsUpdater") as? NSObject.Type,
         indexer.responds(to: NSSelectorFromString("indexChapters:completion:")) {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
          let done: @convention(block) (NSError?) -> Void = { error in
            if let error { continuation.resume(throwing: error) } else { continuation.resume() }
          }
          _ = indexer.perform(NSSelectorFromString("indexChapters:completion:"), with: items as NSArray, with: done)
        }
        return
      }
      try await CSSearchableIndex.default().indexSearchableItems(Self.searchable(items, prefix: "chapter:", rank: 1))
    }

    AsyncFunction("clearIndex") {
      try await CSSearchableIndex.default().deleteSearchableItems(withDomainIdentifiers: ["bsb"])
      // From iOS 18 chapters are App Entities, which the domain delete does not reach.
      if let clearer = NSClassFromString("YadaShortcutsUpdater") as? NSObject.Type,
         clearer.responds(to: NSSelectorFromString("clearChapters:")) {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
          let done: @convention(block) (NSError?) -> Void = { error in
            if let error { continuation.resume(throwing: error) } else { continuation.resume() }
          }
          _ = clearer.perform(NSSelectorFromString("clearChapters:"), with: done)
        }
      }
    }

    /// SX-11: the chapters "Read Psalm 23 in Yada" may name, from the app target (YadaIntents.swift), which
    /// this pod cannot import.
    Function("updateShortcuts") {
      guard let updater = NSClassFromString("YadaShortcutsUpdater") as? NSObject.Type else { return }
      _ = updater.perform(NSSelectorFromString("update"))
    }

    /// SX-13–16: one reminder. Its own thread, so they stack (SX-15); the long-press content in userInfo for
    /// targets/notification (SX-14); and an ordinary relevance, the default, so a Scheduled Summary is not led
    /// by it (decision 5). Taps reach expo-notifications' delegate, which reads userInfo as the data.
    AsyncFunction("scheduleReminder") { (json: String) in
      guard let data = json.data(using: .utf8),
            let request = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let id = request["id"] as? String,
            let at = request["at"] as? Double else { return }
      let content = UNMutableNotificationContent()
      content.title = request["title"] as? String ?? ""
      content.body = request["body"] as? String ?? ""
      content.categoryIdentifier = "reading"
      content.threadIdentifier = reminderThread
      content.sound = .default
      content.relevanceScore = 0
      if let info = request["data"] as? [String: Any] { content.userInfo = info }
      let date = Date(timeIntervalSince1970: at / 1000)
      let when = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
      let trigger = UNCalendarNotificationTrigger(dateMatching: when, repeats: false)
      try await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
    }

    /// Decision 4: a reminder replaces yesterday's. iOS runs nothing of Yada's when one arrives, so the app takes
    /// back the delivered ones whenever it schedules again.
    AsyncFunction("removeDeliveredReminders") {
      let center = UNUserNotificationCenter.current()
      let delivered = await center.deliveredNotifications()
      let ids = delivered.map(\.request).filter { $0.content.threadIdentifier == reminderThread || $0.identifier.hasPrefix("reminder-") }.map(\.identifier)
      center.removeDeliveredNotifications(withIdentifiers: ids)
    }
  }

  private static func searchable(_ items: [[String: String]], prefix: String, rank: Int) -> [CSSearchableItem] {
    items.compactMap { item -> CSSearchableItem? in
      guard let id = item["id"], let title = item["title"], let text = item["text"] else { return nil }
      let attributes = CSSearchableItemAttributeSet(contentType: .text)
      attributes.title = title
      attributes.displayName = title
      // SX-12: "Psalm 23", then "The Lord is my shepherd", then the verse.
      if let name = item["name"], !name.isEmpty {
        attributes.contentDescription = "\(name)\n\(text)"
      } else {
        attributes.contentDescription = "\(text)\nBerean Standard Bible"
      }
      attributes.keywords = (item["keywords"] ?? "").split(separator: "|").map(String.init)
      attributes.rankingHint = NSNumber(value: rank)
      return CSSearchableItem(uniqueIdentifier: "\(prefix)\(id)", domainIdentifier: "bsb", attributeSet: attributes)
    }
  }
}

/// A Spotlight result tapped (MS-02, SX-12): the verse or chapter it names, in the reader.
public class YadaSystemAppDelegate: ExpoAppDelegateSubscriber {
  public func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
    guard userActivity.activityType == CSSearchableItemActionType,
          let id = userActivity.userInfo?[CSSearchableItemActivityIdentifier] as? String,
          id.hasPrefix("verse:") || id.hasPrefix("chapter:") else { return false }
    UserDefaults(suiteName: appGroup)?.set(id, forKey: pendingKey)
    CFNotificationCenterPostNotification(CFNotificationCenterGetDarwinNotifyCenter(), CFNotificationName(doorAnnounce as CFString), nil, nil, true)
    return true
  }
}
