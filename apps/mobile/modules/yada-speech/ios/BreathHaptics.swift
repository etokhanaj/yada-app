// The breath you can follow with eyes closed (BR-01 to BR-03, approved by John 23 Oct 2026): breathing in, soft taps
// that come closer and grow stronger over the in-breath, as Apple Watch's Breathe does; at the turn, one firm tap;
// breathing out, stillness. expo-haptics can only tap once, so the pattern is built here with Core Haptics. iOS's own
// System Haptics switch silences it; Yada adds no switch of its own.

import CoreHaptics

final class BreathHaptics {
  private var engine: CHHapticEngine?
  private var player: CHHapticPatternPlayer?

  /// False where the phone has no Taptic Engine (and in the simulator), so JS falls back to a single tap.
  static var available: Bool { CHHapticEngine.capabilitiesForHardware().supportsHaptics }

  func breatheIn(seconds: Double) throws {
    var events: [CHHapticEvent] = []
    var t = 0.0
    var gap = 0.6
    while t < seconds - 0.15 {
      let share = Float(t / seconds)
      events.append(CHHapticEvent(eventType: .hapticTransient, parameters: [
        CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.2 + 0.5 * share),
        CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.15 + 0.25 * share),
      ], relativeTime: t))
      t += gap
      gap = max(0.18, gap * 0.82)
    }
    try play(events)
  }

  func turn() throws {
    try play([CHHapticEvent(eventType: .hapticTransient, parameters: [
      CHHapticEventParameter(parameterID: .hapticIntensity, value: 1),
      CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.5),
    ], relativeTime: 0)])
  }

  func stop() {
    try? player?.stop(atTime: CHHapticTimeImmediate)
    player = nil
    engine?.stop()
    engine = nil
  }

  private func play(_ events: [CHHapticEvent]) throws {
    let engine = try self.engine ?? makeEngine()
    try? player?.stop(atTime: CHHapticTimeImmediate)
    let player = try engine.makePlayer(with: CHHapticPattern(events: events, parameters: []))
    try player.start(atTime: CHHapticTimeImmediate)
    self.player = player
  }

  private func makeEngine() throws -> CHHapticEngine {
    let engine = try CHHapticEngine()
    engine.isAutoShutdownEnabled = true
    // The system stops the engine when Yada goes to the background or audio is interrupted; the next breath restarts it.
    engine.stoppedHandler = { [weak self] _ in self?.engine = nil }
    engine.resetHandler = { [weak self] in self?.engine = nil }
    try engine.start()
    self.engine = engine
    return engine
  }
}
