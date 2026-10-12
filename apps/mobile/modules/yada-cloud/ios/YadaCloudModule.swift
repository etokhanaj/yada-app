import ExpoModulesCore

/// iCloud key-value storage (NSUbiquitousKeyValueStore) for the reader's
/// bookmarks, reading place, thread progress and reading settings. The merge
/// lives in TypeScript (src/lib/cloudSync.ts); this is only the store.
///
/// KVS rather than CloudKit or iCloud Drive: no account screen, no server and
/// no schema, the data is a few kilobytes against its 1 MB, and it survives a
/// reinstall. When the reader is signed out of iCloud the store still answers,
/// from this device only, so nothing here can fail differently from today.
public class YadaCloudModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("YadaCloud")

    Events("onChange")

    Function("get") { (key: String) -> String? in
      NSUbiquitousKeyValueStore.default.string(forKey: key)
    }

    Function("set") { (key: String, value: String) in
      NSUbiquitousKeyValueStore.default.set(value, forKey: key)
    }

    // Apple: call at launch so changes made elsewhere while the app was not
    // running are fetched; the store also uploads on its own schedule.
    Function("synchronize") { () -> Bool in
      NSUbiquitousKeyValueStore.default.synchronize()
    }

    OnStartObserving {
      self.stopObserving()
      self.observer = NotificationCenter.default.addObserver(
        forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
        object: NSUbiquitousKeyValueStore.default,
        queue: nil
      ) { [weak self] note in
        // Reasons: 0 server change, 1 initial sync, 2 quota violation, 3 account change.
        let reason = note.userInfo?[NSUbiquitousKeyValueStoreChangeReasonKey] as? Int ?? -1
        let keys = note.userInfo?[NSUbiquitousKeyValueStoreChangedKeysKey] as? [String] ?? []
        self?.sendEvent("onChange", ["reason": reason, "keys": keys])
      }
    }

    OnStopObserving {
      self.stopObserving()
    }
  }

  private func stopObserving() {
    if let observer = observer {
      NotificationCenter.default.removeObserver(observer)
      self.observer = nil
    }
  }
}
