// Chapter streaming (Build 11, John 23 Oct 2026: "can't we add this change to build 11?"): a chapter's recording
// plays while it downloads, and the same bytes are saved as they arrive, so a chapter heard once plays offline after
// and nothing is fetched twice. AVPlayer asks this loader for byte ranges of a custom-scheme URL; one URLSession
// download feeds them in order and writes each piece to `savePath`. The 24 kbps files carry their index first
// (-movflags +faststart), so playback starts on the first few kilobytes. JS checks the saved file's size and sha256
// once it is complete (data/recordings.ts), as it checked a downloaded one before.

import AVFoundation
import Foundation

/// The scheme AVPlayer sees, so it hands every byte request to this loader rather than fetching the file itself.
let streamScheme = "yada-stream"

final class StreamLoader: NSObject, AVAssetResourceLoaderDelegate, URLSessionDataDelegate {
  let remote: URL
  let savePath: String
  private let expected: Int64
  private let queue = DispatchQueue(label: "studio.yada.stream")
  private var received = Data()
  private var pending: [AVAssetResourceLoadingRequest] = []
  private var session: URLSession?
  private var handle: FileHandle?
  private var cancelled = false
  /// Every byte arrived and was saved: the file is JS's from here, so a later cancel leaves it alone.
  private var complete = false
  /// Called once on the main queue: true when every expected byte arrived and was saved.
  private let onDone: (Bool) -> Void

  init(remote: URL, savePath: String, expected: Int64, onDone: @escaping (Bool) -> Void) {
    self.remote = remote
    self.savePath = savePath
    self.expected = expected
    self.onDone = onDone
    super.init()
  }

  /// The URL AVPlayer is given: the remote one under `streamScheme`.
  var playerURL: URL {
    var parts = URLComponents(url: remote, resolvingAgainstBaseURL: false)
    parts?.scheme = streamScheme
    return parts?.url ?? remote
  }

  var delegateQueue: DispatchQueue { queue }

  func start() {
    FileManager.default.createFile(atPath: savePath, contents: nil)
    handle = FileHandle(forWritingAtPath: savePath)
    let ops = OperationQueue()
    ops.underlyingQueue = queue
    ops.maxConcurrentOperationCount = 1
    let session = URLSession(configuration: .default, delegate: self, delegateQueue: ops)
    self.session = session
    session.dataTask(with: remote).resume()
  }

  /// Stops a download still running and leaves nothing behind; no completion is reported. Once complete, a no-op.
  func cancel() {
    queue.async {
      guard !self.complete else { return }
      self.cancelled = true
      self.session?.invalidateAndCancel()
      self.session = nil
      try? self.handle?.close()
      self.handle = nil
      try? FileManager.default.removeItem(atPath: self.savePath)
      self.pending.forEach { $0.finishLoading(with: URLError(.cancelled)) }
      self.pending.removeAll()
    }
  }

  // MARK: AVAssetResourceLoaderDelegate (called on `queue`)

  func resourceLoader(_ resourceLoader: AVAssetResourceLoader, shouldWaitForLoadingOfRequestedResource loadingRequest: AVAssetResourceLoadingRequest) -> Bool {
    pending.append(loadingRequest)
    answer()
    return true
  }

  func resourceLoader(_ resourceLoader: AVAssetResourceLoader, didCancel loadingRequest: AVAssetResourceLoadingRequest) {
    pending.removeAll { $0 === loadingRequest }
  }

  // MARK: URLSessionDataDelegate (called on `queue`)

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    guard !cancelled else { return }
    received.append(data)
    try? handle?.write(contentsOf: data)
    answer()
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    guard !cancelled else { return }
    try? handle?.close()
    handle = nil
    session.finishTasksAndInvalidate()
    self.session = nil
    let whole = error == nil && Int64(received.count) == expected
    if whole {
      complete = true
      answer()
    } else {
      // A dropped connection: what played stays played, the partial file goes, and the next play fetches again.
      try? FileManager.default.removeItem(atPath: savePath)
      pending.forEach { $0.finishLoading(with: error ?? URLError(.networkConnectionLost)) }
      pending.removeAll()
    }
    DispatchQueue.main.async { self.onDone(whole) }
  }

  /// Gives every waiting request what has arrived, and finishes those now satisfied.
  private func answer() {
    pending.removeAll { request in
      if let info = request.contentInformationRequest {
        info.contentType = AVFileType.m4a.rawValue
        info.contentLength = expected
        info.isByteRangeAccessSupported = true
      }
      guard let data = request.dataRequest else {
        request.finishLoading()
        return true
      }
      let end = data.requestsAllDataToEndOfResource ? expected : data.requestedOffset + Int64(data.requestedLength)
      let from = data.currentOffset
      let available = Int64(received.count)
      if from < available {
        let upTo = min(available, end)
        data.respond(with: received.subdata(in: Int(from)..<Int(upTo)))
      }
      if data.currentOffset >= end {
        request.finishLoading()
        return true
      }
      return false
    }
  }
}
