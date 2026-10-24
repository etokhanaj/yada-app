// The watch's data (AW-01, AW-03): a week of mornings and evenings, sent to the watch app (targets/watch). An App
// Group is not shared across devices, so the widget's path cannot reach the watch; WatchConnectivity's application
// context holds only the latest copy and arrives when the watch next wakes, so nothing on either side polls.
//
// John's watch showed "Open Yada on your iPhone." with Yada open on the phone (18 Oct 2026): the data went only when
// the app's JS sent it, and nothing answered a watch that had none. So the latest copy is kept in the App Group, the
// session starts at launch, and a watch with nothing asks once and is answered from that copy.

import WatchConnectivity

final class WatchLink: NSObject, WCSessionDelegate {
  static let shared = WatchLink()

  private static let key = "watchSent"
  private let lock = NSLock()
  /// What the complication was last sent: its transfers are budgeted (about 50 a day), so unchanged data is not resent.
  private var lastComplication: String?

  private var latest: String? { UserDefaults(suiteName: appGroup)?.string(forKey: Self.key) }

  /// At launch, before any JS: a watch asking for data is answered even if this launch never computes any.
  func start() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    if session.delegate == nil { session.delegate = self }
    if session.activationState == .activated { flush(session) } else { session.activate() }
  }

  func send(_ json: String) {
    UserDefaults(suiteName: appGroup)?.set(json, forKey: Self.key)
    start()
  }

  private func flush(_ session: WCSession) {
    guard session.isPaired, session.isWatchAppInstalled, let json = latest else { return }
    // Unchanged context is not sent again by WatchConnectivity itself, so this is cheap to repeat.
    try? session.updateApplicationContext(["watch": json])
    lock.lock()
    let changed = lastComplication != json
    lock.unlock()
    // A Yada complication on the face: wake the watch app now, within the day's budget, so the face turns over.
    if changed, session.isComplicationEnabled, session.remainingComplicationUserInfoTransfers > 0 {
      session.transferCurrentComplicationUserInfo(["watch": json])
      lock.lock()
      lastComplication = json
      lock.unlock()
    }
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    if activationState == .activated { flush(session) }
  }

  /// The watch opened with nothing: it asks once, and gets the latest copy back in the reply.
  func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
    replyHandler(latest.map { ["watch": $0] } ?? [:])
  }

  /// The watch app was installed, or a watch paired: send what was waiting.
  func sessionWatchStateDidChange(_ session: WCSession) {
    flush(session)
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  /// A different watch was paired: activate again for it.
  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }
}
