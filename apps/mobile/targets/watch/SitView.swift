// Sit with this on the wrist (AW-03): Settle with a tap on each breath, Breathe the verse, Silence. The timings are
// the iPhone's (lib/sit.ts: in for 4, out for 6, six rounds; Silence at its default 5 minutes), so a step feels the
// same on either device. The steps run full screen on black, the caption at the top naming the step, closed by
// watchOS's own ×. A mindfulness session keeps them running with the wrist down. A finished step does not count the
// day: the rhythm lives on the iPhone, and the watch sends nothing back.

import SwiftUI
import WatchKit

enum Step: String, CaseIterable, Identifiable {
  case settle, breathe, silence
  var id: String { rawValue }
  var title: String {
    switch self {
    case .settle: return "Settle"
    case .breathe: return "Breathe the verse"
    case .silence: return "Silence"
    }
  }
}

extension WatchVerse {
  var halves: (String, String)? {
    guard let b = breathe, b.count == 2 else { return nil }
    return (b[0], b[1])
  }
}

/// lib/sit.ts SETTLE and DEFAULT_SILENCE.
private enum Timing {
  static let inSeconds = 4.0
  static let outSeconds = 6.0
  static let rounds = 6
  static let silence: TimeInterval = 5 * 60
}

struct SitView: View {
  let step: Step
  let verse: WatchVerse
  @Environment(\.dismiss) private var dismiss
  @StateObject private var session = MindfulSession()

  var body: some View {
    VStack(spacing: 10) {
      Text(step.title)
        .font(.caption.weight(.semibold))
        .foregroundStyle(Color("mutedInk"))
        .accessibilityAddTraits(.isHeader)
      Spacer(minLength: 0)
      switch step {
      case .settle: SettleView(onDone: finish)
      case .breathe: BreatheView(halves: verse.halves ?? ("", ""), onDone: finish)
      case .silence: SilenceView(verse: verse, onDone: finish)
      }
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.black.ignoresSafeArea())
    .onAppear { session.start() }
    .onDisappear { session.stop() }
  }

  private func finish() {
    WKInterfaceDevice.current().play(.success)
    // Build 7 plan, accessibility rules: Silence ends with a VoiceOver announcement.
    if step == .silence { AccessibilityNotification.Announcement("Silence has ended").post() }
    dismiss()
  }
}

/// In and out, one phase at a time, with a tap on the wrist at each: lib/sit.ts SETTLE, as the iPhone's useBreath.
@MainActor
final class Breath: ObservableObject {
  @Published private(set) var inhaling = true
  private var task: Task<Void, Never>?

  func run(onDone: @escaping () -> Void) {
    // A second onAppear must not start a second run: double taps on the wrist and onDone twice.
    task?.cancel()
    task = Task { @MainActor in
      for beat in 0..<(Timing.rounds * 2) {
        inhaling = beat % 2 == 0
        WKInterfaceDevice.current().play(inhaling ? .directionUp : .directionDown)
        try? await Task.sleep(nanoseconds: UInt64((inhaling ? Timing.inSeconds : Timing.outSeconds) * 1_000_000_000))
        if Task.isCancelled { return }
      }
      onDone()
    }
  }

  func stop() { task?.cancel() }
  var seconds: Double { inhaling ? Timing.inSeconds : Timing.outSeconds }
}

/// AW-03 Settle: a soft chartreuse light that grows on the in-breath and falls on the out, and the word.
struct SettleView: View {
  let onDone: () -> Void
  @StateObject private var breath = Breath()
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  var body: some View {
    VStack(spacing: 10) {
      Circle()
        .fill(RadialGradient(colors: [Color("accent").opacity(0.6), Color("accent").opacity(0.12)], center: .center, startRadius: 0, endRadius: 60))
        .frame(width: 120, height: 120)
        .scaleEffect(reduceMotion ? 1 : (breath.inhaling ? 1 : 0.6))
        .animation(reduceMotion ? nil : .easeInOut(duration: breath.seconds), value: breath.inhaling)
        .accessibilityHidden(true)
      Text(breath.inhaling ? "In" : "Out")
        .font(.title3.weight(.semibold))
        .foregroundStyle(Color("ink"))
    }
    .onAppear { breath.run(onDone: onDone) }
    .onDisappear { breath.stop() }
  }
}

/// AW-03 Breathe the verse: the first half on the in-breath, the second on the out; the half not being breathed
/// stays at 40%.
struct BreatheView: View {
  let halves: (String, String)
  let onDone: () -> Void
  @StateObject private var breath = Breath()

  var body: some View {
    VStack(spacing: 12) {
      half("In", halves.0, on: breath.inhaling)
      half("Out", halves.1, on: !breath.inhaling)
    }
    .padding(.horizontal, 4)
    .onAppear { breath.run(onDone: onDone) }
    .onDisappear { breath.stop() }
  }

  private func half(_ label: String, _ text: String, on: Bool) -> some View {
    VStack(spacing: 2) {
      Text(label).font(.caption2.weight(.semibold)).foregroundStyle(Color("mutedInk"))
      Text(text).font(Serif.verse(16, relativeTo: .body)).foregroundStyle(Color("ink")).multilineTextAlignment(.center)
    }
    .opacity(on ? 1 : 0.4)
    .accessibilityElement(children: .combine)
  }
}

/// AW-03 Silence: the verse, and the time left counting down, drawn by the system clock rather than redrawn here.
struct SilenceView: View {
  let verse: WatchVerse
  let onDone: () -> Void
  @State private var begun = Date()
  @State private var ends = Date().addingTimeInterval(Timing.silence)

  var body: some View {
    ScrollView {
      VStack(spacing: 10) {
        Text("“\(verse.text)”")
          .font(Serif.verse(16, relativeTo: .body))
          .foregroundStyle(Color("ink"))
          .multilineTextAlignment(.center)
        // A fixed start: Date()...ends built on each render traps once a late redraw (wrist up after the time) puts
        // now past ends (native review, 18 Oct 2026). The system clock counts it down either way.
        Text(timerInterval: begun...ends, countsDown: true)
          .font(.title3.weight(.semibold).monospacedDigit())
          .foregroundStyle(Color("accent"))
      }
      .padding(.horizontal, 4)
    }
    .task {
      try? await Task.sleep(nanoseconds: UInt64(Timing.silence * 1_000_000_000))
      if !Task.isCancelled { onDone() }
    }
  }
}

/// A mindfulness session for as long as a step runs, so its taps and its end reach the wrist when it is lowered.
final class MindfulSession: NSObject, ObservableObject, WKExtendedRuntimeSessionDelegate {
  private var session: WKExtendedRuntimeSession?

  func start() {
    let s = WKExtendedRuntimeSession()
    s.delegate = self
    s.start()
    session = s
  }

  func stop() {
    session?.invalidate()
    session = nil
  }

  func extendedRuntimeSessionDidStart(_ extendedRuntimeSession: WKExtendedRuntimeSession) {}
  func extendedRuntimeSessionWillExpire(_ extendedRuntimeSession: WKExtendedRuntimeSession) {}
  func extendedRuntimeSession(_ extendedRuntimeSession: WKExtendedRuntimeSession, didInvalidateWith reason: WKExtendedRuntimeSessionInvalidationReason, error: Error?) {}
}
