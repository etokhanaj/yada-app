import Combine
import EventKit
import EventKitUI
import ExpoModulesCore
import GroupActivities
import UIKit

/// Pray together (Build 11e; John, 18 Oct 2026: "lets have shareplay"). FaceTime carries the call and its audio; Yada
/// never hears, records or hosts it. The one thing shared is where the circle is in its requests, so the same request
/// is on every screen and Next moves everyone on. The activity carries only the circle's zone name and name: each phone
/// finds the circle in its own iCloud, and request text never leaves the circle's zone.
struct PrayTogether: GroupActivity {
  let circle: String
  let name: String

  var metadata: GroupActivityMetadata {
    var m = GroupActivityMetadata()
    m.title = "Pray together · \(name)"
    m.type = .generic
    return m
  }
}

/// Where the circle is in its requests (PC-16).
struct Step: Codable { let index: Int }
/// Who is here: a member id from the circle's share, sent by each phone as it joins and when someone new does.
struct Here: Codable { let member: String }

public class YadaTogetherModule: Module {
  private var session: GroupSession<PrayTogether>?
  private var messenger: GroupSessionMessenger?
  private var tasks: [Task<Void, Never>] = []
  private var subs = Set<AnyCancellable>()
  private var sessionSubs = Set<AnyCancellable>()
  private let observer = GroupStateObserver()
  private var sessions: Task<Void, Never>?
  private var calendar: CalendarSheet?

  public func definition() -> ModuleDefinition {
    Name("YadaTogether")

    Events("onSession", "onStep", "onHere", "onPeople", "onEnded", "onEligible")

    // Sessions are listened for from launch, so a phone that joins from FaceTime finds Yada ready.
    OnStartObserving {
      guard self.sessions == nil else { return }
      self.sessions = Task { @MainActor in
        for await s in PrayTogether.sessions() { self.attach(s) }
      }
      self.observer.$isEligibleForGroupSession.sink { [weak self] on in self?.sendEvent("onEligible", ["eligible": on]) }.store(in: &self.subs)
    }

    /// True while a FaceTime call is on.
    // Session and observer change on the main thread (attach, end), so they are read there too.
    AsyncFunction("eligible") { () -> Bool in self.observer.isEligibleForGroupSession }.runOnQueue(.main)

    /// In a call, starts SharePlay in it; with none, FaceTime's own sheet picks the people and rings them (PC-15).
    AsyncFunction("start") { (circle: String, name: String) async throws -> String in
      let activity = PrayTogether(circle: circle, name: name)
      if self.observer.isEligibleForGroupSession {
        switch await activity.prepareForActivation() {
        case .activationPreferred:
          _ = try await activity.activate()
          return "started"
        case .activationDisabled: return "disabled"
        default: return "cancelled"
        }
      }
      try await MainActor.run {
        let sheet = try GroupActivitySharingController(activity)
        self.appContext?.utilities?.currentViewController()?.present(sheet, animated: true)
      }
      return "sheet"
    }

    // With no session a send is an error, so a phone left behind says so rather than drifting apart quietly.
    AsyncFunction("step") { (index: Int) async throws in try await self.send(Step(index: index)) }
    AsyncFunction("here") { (member: String) async throws in try await self.send(Here(member: member)) }

    /// Leaves Pray together; the FaceTime call is FaceTime's to end.
    AsyncFunction("leave") { self.session?.leave() }.runOnQueue(.main)

    /// PC-18: Add to calendar through iOS's own event sheet; it is filled, and saving is the reader's choice. From iOS 17
    /// the sheet needs no calendar access. iOS 16 (the deployment target is 16.4) still does, so there Yada asks first,
    /// with NSCalendarsUsageDescription in app.config.ts (App Store audit, 22 Oct 2026).
    AsyncFunction("addToCalendar") { (title: String, start: Double, minutes: Int, weekly: Bool) async in
      let store = EKEventStore()
      if #unavailable(iOS 17) { _ = try? await store.requestAccess(to: .event) }
      await MainActor.run {
        let event = EKEvent(eventStore: store)
        event.title = title
        event.startDate = Date(timeIntervalSince1970: start / 1000)
        event.endDate = event.startDate.addingTimeInterval(TimeInterval(minutes * 60))
        if weekly { event.addRecurrenceRule(EKRecurrenceRule(recurrenceWith: .weekly, interval: 1, end: nil)) }
        let sheet = EKEventEditViewController()
        sheet.eventStore = store
        sheet.event = event
        let delegate = CalendarSheet()
        self.calendar = delegate
        sheet.editViewDelegate = delegate
        self.appContext?.utilities?.currentViewController()?.present(sheet, animated: true)
      }
    }
  }

  private func send<M: Codable>(_ message: M) async throws {
    guard let messenger else { throw Exception(name: "NoSession", description: "Not praying together") }
    try await messenger.send(message)
  }

  @MainActor private func attach(_ s: GroupSession<PrayTogether>) {
    end()
    session = s
    let messenger = GroupSessionMessenger(session: s)
    self.messenger = messenger
    s.$state.sink { [weak self] state in
      if case .invalidated = state {
        self?.sendEvent("onEnded", [:])
        self?.end()
      }
    }.store(in: &sessionSubs)
    s.$activeParticipants.sink { [weak self] people in self?.sendEvent("onPeople", ["count": people.count]) }.store(in: &sessionSubs)
    tasks.append(Task { [weak self] in
      for await (step, _) in messenger.messages(of: Step.self) { self?.sendEvent("onStep", ["index": step.index]) }
    })
    tasks.append(Task { [weak self] in
      for await (here, _) in messenger.messages(of: Here.self) { self?.sendEvent("onHere", ["member": here.member]) }
    })
    s.join()
    sendEvent("onSession", ["circle": s.activity.circle, "name": s.activity.name])
  }

  private func end() {
    sessionSubs.removeAll()
    tasks.forEach { $0.cancel() }
    tasks = []
    messenger = nil
    session = nil
  }
}

/// Closes iOS's event sheet whether the reader added the event or not.
final class CalendarSheet: NSObject, EKEventEditViewDelegate {
  func eventEditViewController(_ controller: EKEventEditViewController, didCompleteWith action: EKEventEditViewAction) {
    controller.dismiss(animated: true)
  }
}
