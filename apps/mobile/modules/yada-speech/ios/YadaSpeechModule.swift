// Read-along on Apple's on-device speech (canvas AU-01…AU-07, refs_ic: "free and offline, with word
// timings for the ink pill").
//
// Why a local module and not expo-speech: expo-speech reports word boundaries on iOS, but it leaves the
// audio session in its default ambient category (silent with the ring switch off, stopped when the screen
// locks), exposes no voice quality beyond enhanced, and has no Now Playing or remote commands. Reading a
// chapter with the phone in a pocket needs all three.
//
// One verse per speak call, as phrases: JS cuts a verse at its sentences and clauses and chooses the rests
// (lib/audio/cadence.ts), because SSML <break> and IPA attributes move the word ranges off the plain text
// (docs/research/speech-cadence.md). Each phrase is its own utterance with a postUtteranceDelay, Apple's
// documented way to pause between sentences, and its ranges are reported plus the phrase's offset, so JS
// sees offsets into the verse's whole spoken form. JS owns the queue (data/audio.ts); events carry the id
// JS chose, so an event from a cancelled verse is ignored there.

import AVFoundation
import ExpoModulesCore
import MediaPlayer
import UIKit

struct Phrase: Record {
  @Field var text: String = ""
  /// UTF-16 offset of this phrase in the verse's spoken form (JS strings and NSRange agree on UTF-16).
  @Field var offset: Int = 0
  /// Seconds of rest after this phrase, already scaled for the speed.
  @Field var pause: Double = 0
}

struct NowPlaying: Record {
  @Field var title: String = ""
  @Field var artist: String = ""
  @Field var playing: Bool = false
}

struct Segment: Record {
  /// A local file path to the chapter's recording (data/recordings.ts keeps it in Documents).
  @Field var path: String = ""
  /// Seconds into the file where this verse starts and ends.
  @Field var start: Double = 0
  @Field var end: Double = 0
  /// When each word starts, and where it sits in the verse's spoken form (the same offsets onRange carries).
  @Field var times: [Double] = []
  @Field var locations: [Int] = []
}

public class YadaSpeechModule: Module {
  private let synth = AVSpeechSynthesizer()
  /// The human-read recording (BA-01): one chapter file, played a verse at a time so JS keeps one queue for
  /// both voices. A verse that follows on in the same file carries on without a seek, so there is no gap.
  private var player: AVAudioPlayer?
  private var playerPath: String?
  private var segment: Segment?
  private var segmentId: String?
  private var nextWord = 0
  private var ticker: Timer?
  private var delegate: Delegate?
  private var commandsReady = false
  private var sessionObservers: [NSObjectProtocol] = []
  /// The verse now queued is in the reader's Personal Voice.
  fileprivate var speakingPersonal = false
  /// A quiet sound under Daily prayer or Sit with this (AS-01, build 8): opt-in, looped, faded in and out.
  private var ambient: AVAudioPlayer?

  public func definition() -> ModuleDefinition {
    Name("YadaSpeech")

    Events("onStart", "onRange", "onFinish", "onCancel", "onRemote", "onInterruption", "onRouteLost", "onVoiceUnavailable")

    OnCreate {
      let delegate = Delegate(module: self)
      self.delegate = delegate
      self.synth.delegate = delegate
      // The synthesizer plays through the app's session, so the category below governs it.
      self.synth.usesApplicationAudioSession = true
      self.observeSession()
    }

    OnDestroy {
      self.sessionObservers.forEach { NotificationCenter.default.removeObserver($0) }
      self.synth.stopSpeaking(at: .immediate)
    }

    /// The best installed English voice, or null when there is none (Listen is then hidden).
    Function("voice") { () -> [String: Any]? in
      guard let voice = Self.bestVoice() else { return nil }
      return Self.describe(voice)
    }

    /// "unsupported" (before iOS 17, and in the Simulator), "notDetermined", "denied" or "authorized".
    Function("personalVoiceStatus") { () -> String in
      Self.personalStatus()
    }

    /// Asks once, when the reader chooses Personal Voice in the player; never at launch.
    AsyncFunction("requestPersonalVoice") { (promise: Promise) in
      guard #available(iOS 17.0, *) else {
        promise.resolve("unsupported")
        return
      }
      AVSpeechSynthesizer.requestPersonalVoiceAuthorization { _ in
        promise.resolve(Self.personalStatus())
      }
    }

    /// The reader's own Personal Voice, when authorized and one has been made; else null.
    Function("personalVoice") { () -> [String: Any]? in
      guard let voice = Self.personalVoice() else { return nil }
      return Self.describe(voice)
    }

    /// `voiceId` null: the best system voice. `lead`: the rest before the first phrase, in seconds.
    AsyncFunction("speak") { (id: String, phrases: [Phrase], rate: Double, lead: Double, voiceId: String?) in
      try self.activateSession()
      self.setUpRemoteCommands()
      // The recording runs on past a verse's end by design; the iPhone voice taking over must silence it
      // (review, 12 Oct 2026: both read at once after a switch in the Voice sheet).
      if self.player != nil { self.stopRecording() }
      if self.synth.isSpeaking || self.synth.isPaused {
        self.synth.stopSpeaking(at: .immediate)
      }
      self.delegate?.tags.removeAll()
      let voice = self.voiceFor(voiceId)
      self.speakingPersonal = Self.isPersonal(voice)
      let clamped = Float(min(max(rate, Double(AVSpeechUtteranceMinimumSpeechRate)), Double(AVSpeechUtteranceMaximumSpeechRate)))
      for (k, phrase) in phrases.enumerated() {
        let utterance = AVSpeechUtterance(string: phrase.text)
        utterance.voice = voice
        utterance.rate = clamped
        utterance.preUtteranceDelay = k == 0 ? max(0, lead) : 0
        // No rest after the last phrase: didFinish fires before a postUtteranceDelay runs (probe,
        // 11 Oct 2026), so the rest between verses is the next verse's lead instead.
        utterance.postUtteranceDelay = k == phrases.count - 1 ? 0 : max(0, phrase.pause)
        self.delegate?.tags[ObjectIdentifier(utterance)] = Tag(
          utterance: utterance, id: id, offset: phrase.offset, first: k == 0, last: k == phrases.count - 1)
        self.synth.speak(utterance)
      }
    }.runOnQueue(.main)

    /// One verse of a recording: plays from `start`, reports each word as it passes and finishes at `end`.
    AsyncFunction("playSegment") { (id: String, segment: Segment, rate: Double) in
      try self.activateSession()
      self.setUpRemoteCommands()
      if self.synth.isSpeaking || self.synth.isPaused { self.synth.stopSpeaking(at: .immediate) }
      if self.playerPath != segment.path || self.player == nil {
        self.player?.stop()
        let player = try AVAudioPlayer(contentsOf: URL(fileURLWithPath: segment.path))
        player.enableRate = true
        player.prepareToPlay()
        self.player = player
        self.playerPath = segment.path
      }
      guard let player = self.player else { return }
      player.rate = Float(min(max(rate, 0.5), 2.0))
      // Carry on without a seek when this verse starts where the last one stopped (within a quarter second).
      if !(player.isPlaying && abs(player.currentTime - segment.start) < 0.25) {
        player.currentTime = segment.start
      }
      self.segment = segment
      self.segmentId = id
      self.nextWord = 0
      if !player.isPlaying { player.play() }
      self.sendEvent("onStart", ["id": id])
      self.startTicker()
    }.runOnQueue(.main)

    AsyncFunction("pause") {
      // .immediate, not .word: pause answers the tap at once, and continue resumes mid-word cleanly.
      _ = self.synth.pauseSpeaking(at: .immediate)
      self.pausePlayer()
    }.runOnQueue(.main)

    AsyncFunction("resume") { () -> Bool in
      try self.activateSession()
      // Paused in the Personal Voice, then Play from the lock screen: didEnterBackground saw it paused
      // and sent nothing, so continuing would read on in the Personal Voice in the background (voiceFor).
      // False makes JS restart at the word, and that speak call gets the system voice.
      if self.speakingPersonal && UIApplication.shared.applicationState != .active { return false }
      if let player = self.player, self.segment != nil {
        player.play()
        self.startTicker()
        return true
      }
      return self.synth.continueSpeaking()
    }.runOnQueue(.main)

    // AS-01 (John, 17 Oct 2026): "ambient sound ... an easy way they can opt in or out". A release build passes a
    // file in the app; a development build passes Metro's URL, read as data.
    AsyncFunction("playAmbient") { (uri: String, volume: Double) in
      try self.activateSession()
      guard let url = URL(string: uri) else { return }
      let p = url.isFileURL ? try AVAudioPlayer(contentsOf: url) : try AVAudioPlayer(data: Data(contentsOf: url))
      p.numberOfLoops = -1
      p.volume = 0
      p.play()
      p.setVolume(Float(volume), fadeDuration: 2)
      self.ambient?.stop()
      self.ambient = p
    }.runOnQueue(.main)

    AsyncFunction("stopAmbient") {
      guard let p = self.ambient else { return }
      self.ambient = nil
      p.setVolume(0, fadeDuration: 1)
      DispatchQueue.main.asyncAfter(deadline: .now() + 1) { p.stop() }
    }.runOnQueue(.main)

    AsyncFunction("stop") {
      self.stopRecording()
      self.synth.stopSpeaking(at: .immediate)
      self.delegate?.tags.removeAll()
      self.speakingPersonal = false
    }.runOnQueue(.main)

    AsyncFunction("setNowPlaying") { (info: NowPlaying) in
      self.setUpRemoteCommands()
      var nowPlaying: [String: Any] = [
        MPMediaItemPropertyTitle: info.title,
        MPMediaItemPropertyArtist: info.artist,
        MPNowPlayingInfoPropertyPlaybackRate: info.playing ? 1.0 : 0.0,
        MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue,
      ]
      // Without artwork the lock screen and Dynamic Island show a blank tile, not Yada.
      if let artwork = YadaSpeechModule.artwork {
        nowPlaying[MPMediaItemPropertyArtwork] = artwork
      }
      MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlaying
    }.runOnQueue(.main)

    AsyncFunction("clearNowPlaying") {
      MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
      try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }.runOnQueue(.main)
  }

  /// The app icon from this pod's resource bundle (YadaSpeech.podspec), loaded once.
  private static let artwork: MPMediaItemArtwork? = {
    guard
      let url = Bundle(for: YadaSpeechModule.self).url(forResource: "YadaSpeech", withExtension: "bundle"),
      let bundle = Bundle(url: url),
      let path = bundle.path(forResource: "NowPlayingArtwork", ofType: "png"),
      let image = UIImage(contentsOfFile: path)
    else { return nil }
    return MPMediaItemArtwork(boundsSize: image.size) { _ in image }
  }()

  // MARK: - Recording

  private func startTicker() {
    ticker?.invalidate()
    // Twenty times a second: enough for the word pill to follow speech without spending the battery.
    ticker = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in self?.tick() }
  }

  private func tick() {
    guard let player, let segment, let id = segmentId else { return }
    let now = player.currentTime
    while nextWord < segment.times.count, nextWord < segment.locations.count, segment.times[nextWord] <= now {
      sendEvent("onRange", ["id": id, "location": segment.locations[nextWord], "length": 1])
      nextWord += 1
    }
    // Every pause stops the ticker, so a stopped player here reached the end of the file, where it puts
    // currentTime back to 0 (review, 12 Oct 2026: the last verse never finished). Mid-verse, a stop the
    // system made (an interruption arriving after this tick) is left to its notification.
    let ended = !player.isPlaying && (now < 0.05 || now >= segment.end - 0.3)
    if now >= segment.end - 0.02 || ended {
      // The verse is done; the player runs on into the next verse, which JS asks for at once.
      self.segment = nil
      self.segmentId = nil
      ticker?.invalidate()
      ticker = nil
      sendEvent("onFinish", ["id": id])
    }
  }

  private func pausePlayer() {
    player?.pause()
    ticker?.invalidate()
    ticker = nil
  }

  private func stopRecording() {
    ticker?.invalidate()
    ticker = nil
    player?.stop()
    player = nil
    playerPath = nil
    segment = nil
    segmentId = nil
  }

  // MARK: - Voice

  static func describe(_ voice: AVSpeechSynthesisVoice) -> [String: Any] {
    [
      "id": voice.identifier,
      "name": voice.name,
      "language": voice.language,
      "quality": qualityName(voice.quality),
    ]
  }

  /// Premium > enhanced > default; among equals, the device's own English (en-GB on a UK phone), then
  /// en-US, then any en-*. Novelty voices (Bad News, Bubbles…) and Personal Voice are never chosen here:
  /// Personal Voice is the reader's own choice (personalVoice).
  static func bestVoice() -> AVSpeechSynthesisVoice? {
    let preferred = Locale.preferredLanguages.first { $0.hasPrefix("en") } ?? "en-US"
    let english = AVSpeechSynthesisVoice.speechVoices().filter { voice in
      guard voice.language.hasPrefix("en") else { return false }
      if #available(iOS 17.0, *) {
        if voice.voiceTraits.contains(.isNoveltyVoice) || voice.voiceTraits.contains(.isPersonalVoice) { return false }
      }
      return true
    }
    func rank(_ v: AVSpeechSynthesisVoice) -> (Int, Int) {
      let quality: Int
      switch v.quality {
      case .premium: quality = 3
      case .enhanced: quality = 2
      default: quality = 1
      }
      let place = v.language == preferred ? 2 : (v.language == "en-US" ? 1 : 0)
      return (quality, place)
    }
    return english.max { a, b in rank(a) < rank(b) }
  }

  /// The voice for a speak call. A Personal Voice only while authorized and in the foreground: in the
  /// background it is reported to fall back or fail (Apple Developer Forums thread 736148, unanswered),
  /// so the lock screen reads in the best system voice and the reader's own voice returns in the app.
  private func voiceFor(_ id: String?) -> AVSpeechSynthesisVoice? {
    guard let id, let voice = AVSpeechSynthesisVoice(identifier: id) else { return Self.bestVoice() }
    guard Self.isPersonal(voice) else { return voice }
    let usable = Self.personalStatus() == "authorized" && UIApplication.shared.applicationState == .active
    return usable ? voice : Self.bestVoice()
  }

  static func isPersonal(_ voice: AVSpeechSynthesisVoice?) -> Bool {
    guard let voice, #available(iOS 17.0, *) else { return false }
    return voice.voiceTraits.contains(.isPersonalVoice)
  }

  static func personalVoice() -> AVSpeechSynthesisVoice? {
    guard personalStatus() == "authorized" else { return nil }
    return AVSpeechSynthesisVoice.speechVoices().first { isPersonal($0) }
  }

  static func personalStatus() -> String {
    guard #available(iOS 17.0, *) else { return "unsupported" }
    switch AVSpeechSynthesizer.personalVoiceAuthorizationStatus {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .notDetermined: return "notDetermined"
    default: return "unsupported"
    }
  }

  static func qualityName(_ quality: AVSpeechSynthesisVoiceQuality) -> String {
    switch quality {
    case .premium: return "premium"
    case .enhanced: return "enhanced"
    default: return "default"
    }
  }

  // MARK: - Audio session

  /// Playback, spoken audio: keeps reading with the screen locked or the ring switch on silent, and lets
  /// other spoken-audio apps pause rather than talk over it.
  private func activateSession() throws {
    let session = AVAudioSession.sharedInstance()
    if session.category != .playback || session.mode != .spokenAudio {
      try session.setCategory(.playback, mode: .spokenAudio, options: [])
    }
    try session.setActive(true)
  }

  private func observeSession() {
    let center = NotificationCenter.default
    sessionObservers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
      guard let self, let info = note.userInfo,
            let raw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
            let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
      if type == .began {
        // A call or Siri: pause and stay paused unless the system says to resume (coordinator, 11 Oct 2026).
        _ = self.synth.pauseSpeaking(at: .immediate)
        self.pausePlayer()
        self.sendEvent("onInterruption", ["began": true, "shouldResume": false])
      } else {
        let opts = AVAudioSession.InterruptionOptions(rawValue: (info[AVAudioSessionInterruptionOptionKey] as? UInt) ?? 0)
        self.sendEvent("onInterruption", ["began": false, "shouldResume": opts.contains(.shouldResume)])
      }
    })
    sessionObservers.append(center.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] note in
      guard let self, let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
            AVAudioSession.RouteChangeReason(rawValue: raw) == .oldDeviceUnavailable else { return }
      // Headphones pulled or Bluetooth gone: never carry on out of the speaker.
      _ = self.synth.pauseSpeaking(at: .immediate)
      self.pausePlayer()
      self.sendEvent("onRouteLost", [:])
    })
    sessionObservers.append(center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
      // The verse queued is in the Personal Voice, which is not used in the background (voiceFor): JS
      // restarts it at the word being spoken, and that speak call gets the system voice.
      guard let self, self.speakingPersonal, self.synth.isSpeaking, !self.synth.isPaused else { return }
      self.sendEvent("onVoiceUnavailable", [:])
    })
  }

  // MARK: - Remote commands (lock screen, Control Center, headphones)

  private func setUpRemoteCommands() {
    guard !commandsReady else { return }
    commandsReady = true
    let center = MPRemoteCommandCenter.shared()
    let send = { [weak self] (name: String) -> MPRemoteCommandHandlerStatus in
      self?.sendEvent("onRemote", ["command": name])
      return .success
    }
    center.playCommand.addTarget { _ in send("play") }
    center.pauseCommand.addTarget { _ in send("pause") }
    center.togglePlayPauseCommand.addTarget { _ in send("toggle") }
    // Previous and next track are previous and next verse: scripture is addressed by verse (refs_au).
    center.nextTrackCommand.addTarget { _ in send("next") }
    center.previousTrackCommand.addTarget { _ in send("previous") }
    for command in [center.playCommand, center.pauseCommand, center.togglePlayPauseCommand, center.nextTrackCommand, center.previousTrackCommand] {
      command.isEnabled = true
    }
    // No times exist (there is no audio file), so seeking and ±15 s would be invented.
    for command in [center.skipForwardCommand, center.skipBackwardCommand, center.changePlaybackPositionCommand, center.seekForwardCommand, center.seekBackwardCommand] {
      command.isEnabled = false
    }
  }

  // MARK: - Delegate

  /// Which verse an utterance belongs to, where its phrase sits, and whether it opens or closes the
  /// verse. It holds the utterance, so the ObjectIdentifier key cannot be reused while the tag is kept.
  struct Tag {
    let utterance: AVSpeechUtterance
    let id: String
    let offset: Int
    let first: Bool
    let last: Bool
  }

  final class Delegate: NSObject, AVSpeechSynthesizerDelegate {
    weak var module: YadaSpeechModule?
    var tags: [ObjectIdentifier: Tag] = [:]

    init(module: YadaSpeechModule) {
      self.module = module
    }

    func speechSynthesizer(_ s: AVSpeechSynthesizer, didStart u: AVSpeechUtterance) {
      guard let tag = tags[ObjectIdentifier(u)], tag.first else { return }
      module?.sendEvent("onStart", ["id": tag.id])
    }

    func speechSynthesizer(_ s: AVSpeechSynthesizer, willSpeakRangeOfSpeechString range: NSRange, utterance u: AVSpeechUtterance) {
      guard let tag = tags[ObjectIdentifier(u)] else { return }
      module?.sendEvent("onRange", ["id": tag.id, "location": tag.offset + range.location, "length": range.length])
    }

    func speechSynthesizer(_ s: AVSpeechSynthesizer, didFinish u: AVSpeechUtterance) {
      guard let tag = tags.removeValue(forKey: ObjectIdentifier(u)) else { return }
      // A verse ends with its last phrase; the others hand on inside the synthesizer's own queue.
      guard tag.last else { return }
      module?.speakingPersonal = false
      module?.sendEvent("onFinish", ["id": tag.id])
    }

    func speechSynthesizer(_ s: AVSpeechSynthesizer, didCancel u: AVSpeechUtterance) {
      guard let tag = tags.removeValue(forKey: ObjectIdentifier(u)) else { return }
      module?.sendEvent("onCancel", ["id": tag.id])
    }
  }
}
