// The watch's data (AW-01, AW-03): a week of mornings and evenings, sent to the watch app (targets/watch). An App
// Group is not shared across devices, so the widget's path cannot reach the watch; WatchConnectivity's application
// context holds only the latest copy and arrives when the watch next wakes, so nothing on either side polls.

import WatchConnectivity

final class WatchLink: NSObject, WCSessionDelegate {
  static let shared = WatchLink()

  private let lock = NSLock()
  /// The latest data, kept until it reaches a paired watch with Yada installed: the first call usually comes before
  /// activation, and data sent before the watch app was installed was dropped (native review, 18 Oct 2026).
  private var waiting: [String: Any]?
  /// What the complication was last sent: its transfers are budgeted (about 50 a day), so unchanged data is not resent.
  private var lastComplication: String?

  func send(_ json: String) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    let context: [String: Any] = ["watch": json]
    lock.lock()
    waiting = context
    lock.unlock()
    if session.activationState == .activated {
      flush(session)
    } else {
      session.delegate = self
      session.activate()
    }
  }

  private func flush(_ session: WCSession) {
    guard session.isPaired, session.isWatchAppInstalled else { return }
    lock.lock()
    let context = waiting
    lock.unlock()
    guard let context, let json = context["watch"] as? String else { return }
    do {
      try session.updateApplicationContext(context)
    } catch {
      return
    }
    lock.lock()
    if (waiting?["watch"] as? String) == json { waiting = nil }
    let changed = lastComplication != json
    lock.unlock()
    // A Yada complication on the face: wake the watch app now, within the day's budget, so the face turns over.
    if changed, session.isComplicationEnabled, session.remainingComplicationUserInfoTransfers > 0 {
      session.transferCurrentComplicationUserInfo(context)
      lock.lock()
      lastComplication = json
      lock.unlock()
    }
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    if activationState == .activated { flush(session) }
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
