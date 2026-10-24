// The Apple Watch app (AW-01, AW-03). It shows what the Smart Stack shows, opened, and runs Sit with this on the
// wrist. The iPhone sends a week of mornings and evenings (modules/yada-system WatchLink.swift); this keeps the
// latest in the App Group for the widgets and asks them to draw again. Nothing here polls: the phone's context
// arrives when watchOS hands it over, and the screen turns to the next part at its boundary only.

import SwiftUI
import WatchConnectivity
import WatchKit
import WidgetKit

@main
struct YadaWatchApp: App {
  @WKApplicationDelegateAdaptor private var delegate: WatchDelegate

  var body: some Scene {
    WindowGroup {
      NavigationStack { TodayView() }
        .environmentObject(WatchStore.shared)
    }
  }
}

/// Takes the iPhone's data while the app is not running: watchOS wakes it with a background task, which ends once
/// WatchConnectivity has nothing more to hand over.
final class WatchDelegate: NSObject, WKApplicationDelegate {
  func applicationDidFinishLaunching() {
    WatchStore.shared.activate()
  }

  func handle(_ backgroundTasks: Set<WKRefreshBackgroundTask>) {
    for task in backgroundTasks {
      if let link = task as? WKWatchConnectivityRefreshBackgroundTask {
        WatchStore.shared.finishWhenDelivered(link)
      } else {
        task.setTaskCompletedWithSnapshot(false)
      }
    }
  }
}

final class WatchStore: NSObject, ObservableObject, WCSessionDelegate {
  static let shared = WatchStore()

  @Published private(set) var data: WatchData? = WatchData.load()
  private var waiting: [WKWatchConnectivityRefreshBackgroundTask] = []
  private var pending: NSKeyValueObservation?

  func activate() {
    guard WCSession.isSupported(), WCSession.default.delegate == nil else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  /// Completes the task when WatchConnectivity says nothing is left to deliver (observed, not polled).
  func finishWhenDelivered(_ task: WKWatchConnectivityRefreshBackgroundTask) {
    activate()
    DispatchQueue.main.async {
      self.waiting.append(task)
      self.pending = WCSession.default.observe(\.hasContentPending, options: [.initial, .new]) { [weak self] _, _ in
        DispatchQueue.main.async { self?.finishWaiting() }
      }
    }
  }

  /// Done only once the session is active and nothing is pending: before activation hasContentPending already reads
  /// false, and a cold background launch completed at once, before the context arrived (native review, 18 Oct 2026).
  private func finishWaiting() {
    guard WCSession.default.activationState == .activated, !WCSession.default.hasContentPending else { return }
    waiting.forEach { $0.setTaskCompletedWithSnapshot(false) }
    waiting.removeAll()
    pending = nil
  }

  private func take(_ context: [String: Any]) {
    guard let json = context[watchKey] as? String, let decoded = WatchData.decode(json) else { return }
    UserDefaults(suiteName: watchGroup)?.set(json, forKey: watchKey)
    WidgetCenter.shared.reloadAllTimelines()
    DispatchQueue.main.async { self.data = decoded }
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    guard activationState == .activated else { return }
    take(session.receivedApplicationContext)
    askIfEmpty(session)
  }

  /// With nothing from the iPhone yet, ask it once (it answers from its last copy, waking in the background), and again
  /// only when it becomes reachable: John's watch sat on "Open Yada on your iPhone." (18 Oct 2026).
  private func askIfEmpty(_ session: WCSession) {
    guard session.activationState == .activated, session.isReachable, WatchData.decode(UserDefaults(suiteName: watchGroup)?.string(forKey: watchKey) ?? "") == nil else { return }
    session.sendMessage(["need": "watch"], replyHandler: { [weak self] reply in self?.take(reply) }, errorHandler: nil)
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    askIfEmpty(session)
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    take(applicationContext)
  }

  /// The iPhone's complication transfer (a Yada complication on the face): the same data, sooner.
  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    take(userInfo)
  }
}
