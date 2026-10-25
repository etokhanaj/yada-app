// The recordings by Heart and George, a verse at a time (BA-01), with Now Playing, remote commands, the breath's
// haptics and Sit's rain. Apple's on-device speech was removed in Build 12 (John, 24 Oct 2026: "our default sound is
// the apple voice, can we change that?"): every verse is now read from a recording.
//
// JS owns the queue (data/audio.ts); events carry the id JS chose, so an event from a cancelled verse is ignored there.

import AVFoundation
import ExpoModulesCore
import MediaPlayer
import UIKit

struct NowPlaying: Record {
  @Field var title: String = ""
  @Field var artist: String = ""
  @Field var playing: Bool = false
  /// From the recording's timings.
  @Field var elapsed: Double? = nil
  @Field var duration: Double? = nil
  @Field var rate: Double = 1
}

struct Segment: Record {
  /// The chapter's recording: a local file path (data/recordings.ts keeps it in Documents), or its https URL while it
  /// streams the first time (StreamLoader.swift), saved to `savePath` as it arrives.
  @Field var path: String = ""
  @Field var savePath: String? = nil
  /// The file's size from the manifest, which the stream reports to the player before the bytes arrive.
  @Field var bytes: Int = 0
  /// Seconds into the file where this verse starts and ends.
  @Field var start: Double = 0
  @Field var end: Double = 0
  /// When each word starts, and where it sits in the verse's spoken form (the same offsets onRange carries).
  @Field var times: [Double] = []
  @Field var locations: [Int] = []
}

public class YadaSpeechModule: Module {
  private let breath = BreathHaptics()
  /// The recording (BA-01): one chapter file, played a verse at a time. A verse that follows on in the same file
  /// carries on without a seek, so there is no gap.
  private var player: AVPlayer?
  private var playerPath: String?
  /// The chapter now streaming, kept alive here: an asset's resource loader holds its delegate weakly.
  private var stream: StreamLoader?
  private var bufferingObservation: NSKeyValueObservation?
  /// The speed the recording plays at, kept for resume: AVPlayer's rate is 0 while paused.
  private var playRate: Float = 1
  private var segment: Segment?
  private var segmentId: String?
  private var nextWord = 0
  private var ticker: Timer?
  private var commandsReady = false
  private var sessionObservers: [NSObjectProtocol] = []
  /// A quiet sound under Daily prayer or Sit with this (AS-01, build 8): opt-in, looped, faded in and out.
  private var ambient: AVAudioPlayer?

  public func definition() -> ModuleDefinition {
    Name("YadaSpeech")

    Events("onStart", "onRange", "onFinish", "onRemote", "onInterruption", "onRouteLost", "onBuffering", "onStreamSaved", "onStreamFailed")

    OnCreate {
      self.observeSession()
    }

    OnDestroy {
      self.sessionObservers.forEach { NotificationCenter.default.removeObserver($0) }
      self.stopRecording()
    }

    /// One verse of a recording: plays from `start`, reports each word as it passes and finishes at `end`.
    AsyncFunction("playSegment") { (id: String, segment: Segment, rate: Double) in
      try self.activateSession()
      self.setUpRemoteCommands()
      if self.playerPath != segment.path || self.player == nil {
        self.stopRecording()
        self.player = try self.makePlayer(segment)
        self.playerPath = segment.path
      }
      guard let player = self.player else { return }
      self.playRate = Float(min(max(rate, 0.5), 2.0))
      // Carry on without a seek when this verse starts where the last one stopped (within a quarter second).
      if !(self.isPlaying && abs(self.position - segment.start) < 0.25) {
        player.seek(to: CMTime(seconds: segment.start, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
      }
      self.segment = segment
      self.segmentId = id
      self.nextWord = 0
      player.rate = self.playRate
      self.sendEvent("onStart", ["id": id])
      self.startTicker()
    }.runOnQueue(.main)

    AsyncFunction("pause") {
      self.pausePlayer()
    }.runOnQueue(.main)

    AsyncFunction("resume") { () -> Bool in
      try self.activateSession()
      // False when nothing was paused mid-verse: JS plays the verse again from its start.
      guard let player = self.player, self.segment != nil else { return false }
      player.rate = self.playRate
      self.startTicker()
      return true
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

    // BR-01 to BR-03: "in" plays the rising taps over `seconds`, "out" the one firm tap at the turn. False where the
    // phone can't play the pattern, so JS taps once instead.
    AsyncFunction("breathe") { (phase: String, seconds: Double) -> Bool in
      guard BreathHaptics.available else { return false }
      if phase == "in" { try self.breath.breatheIn(seconds: seconds) } else { try self.breath.turn() }
      return true
    }.runOnQueue(.main)

    AsyncFunction("stopBreathing") {
      self.breath.stop()
    }.runOnQueue(.main)

    AsyncFunction("stop") {
      self.stopRecording()
    }.runOnQueue(.main)

    AsyncFunction("setNowPlaying") { (info: NowPlaying) in
      self.setUpRemoteCommands()
      var nowPlaying: [String: Any] = [
        MPMediaItemPropertyTitle: info.title,
        MPMediaItemPropertyArtist: info.artist,
        MPNowPlayingInfoPropertyPlaybackRate: info.playing ? info.rate : 0.0,
        MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue,
      ]
      // The bar runs from the verse's start at the reading's speed until the next verse sets it again.
      if let elapsed = info.elapsed, let duration = info.duration {
        // The player's own position, so a pause or a resume mid-verse shows where it is, not where the verse began.
        nowPlaying[MPNowPlayingInfoPropertyElapsedPlaybackTime] = self.player == nil ? elapsed : self.position
        nowPlaying[MPMediaItemPropertyPlaybackDuration] = duration
      }
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
    guard player != nil, let segment, let id = segmentId else { return }
    let now = position
    while nextWord < segment.times.count, nextWord < segment.locations.count, segment.times[nextWord] <= now {
      sendEvent("onRange", ["id": id, "location": segment.locations[nextWord], "length": 1])
      nextWord += 1
    }
    // Every pause stops the ticker, so a stopped player here reached the end of the file (review, 12 Oct 2026: the
    // last verse never finished). Mid-verse, a stop the system made (an interruption arriving after this tick) is
    // left to its notification. A stream waiting for bytes keeps its rate, so it is not taken for an end.
    let ended = !isPlaying && (now < 0.05 || now >= segment.end - 0.3)
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
    player?.pause()
    player = nil
    playerPath = nil
    bufferingObservation = nil
    // A stream that has not finished is let go: the next play of that chapter fetches it again.
    stream?.cancel()
    stream = nil
    segment = nil
    segmentId = nil
  }

  private var isPlaying: Bool { (player?.rate ?? 0) != 0 }

  private var position: Double {
    let t = player?.currentTime().seconds ?? 0
    return t.isFinite ? t : 0
  }

  /// One AVPlayer for both a saved chapter and a streaming one; it tells JS when it waits for bytes (onBuffering).
  private func makePlayer(_ segment: Segment) throws -> AVPlayer {
    let asset: AVURLAsset
    if let remote = URL(string: segment.path), remote.scheme == "https", let savePath = segment.savePath {
      let path = segment.path
      // The loader stays with the player until the chapter changes: it still answers a seek back once complete.
      let loader = StreamLoader(remote: remote, savePath: savePath, expected: Int64(segment.bytes)) { [weak self] whole in
        guard let self else { return }
        self.sendEvent(whole ? "onStreamSaved" : "onStreamFailed", ["url": path, "savePath": savePath])
      }
      asset = AVURLAsset(url: loader.playerURL)
      asset.resourceLoader.setDelegate(loader, queue: loader.delegateQueue)
      self.stream = loader
      loader.start()
    } else {
      asset = AVURLAsset(url: URL(fileURLWithPath: segment.path))
    }
    let item = AVPlayerItem(asset: asset)
    // Speech at 0.75x to 1.5x keeps its pitch, as AVAudioPlayer's enableRate did.
    item.audioTimePitchAlgorithm = .timeDomain
    let player = AVPlayer(playerItem: item)
    bufferingObservation = player.observe(\.timeControlStatus, options: [.new]) { [weak self] p, _ in
      let waiting = p.timeControlStatus == .waitingToPlayAtSpecifiedRate
      DispatchQueue.main.async { self?.sendEvent("onBuffering", ["waiting": waiting]) }
    }
    return player
  }

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
      self.pausePlayer()
      self.sendEvent("onRouteLost", [:])
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
}
