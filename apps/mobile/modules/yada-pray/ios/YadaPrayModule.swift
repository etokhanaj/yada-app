import CloudKit
import ExpoModulesCore
import UIKit

/// Pray for others (build 7 plan §2 row 18, built in build 8): requests in iCloud.studio.yada.reader's public
/// database. A request lives 7 days and can be renewed; "N prayed" is counted from Prayed marks and shown only to the
/// asker; three reports hide a request until John looks. No names but an optional first name, and nothing about the
/// reader leaves the device except what they post. Schema: apps/mobile/cloudkit/schema.ckdb.
public class YadaPrayModule: Module {
  private let container = CKContainer(identifier: "iCloud.studio.yada.reader")
  private var db: CKDatabase { container.publicCloudDatabase }
  private static let live: TimeInterval = 7 * 24 * 3600
  private static let hideAt = 3

  public func definition() -> ModuleDefinition {
    Name("YadaPray")

    AsyncFunction("accountStatus") { () async throws -> String in
      switch try await self.container.accountStatus() {
      case .available: return "available"
      case .noAccount: return "noAccount"
      case .restricted: return "restricted"
      case .temporarilyUnavailable: return "temporarilyUnavailable"
      default: return "couldNotDetermine"
      }
    }

    AsyncFunction("ask") { (text: String, firstName: String) async throws -> String in
      let r = CKRecord(recordType: "PrayerRequest")
      r["text"] = text as CKRecordValue
      r["firstName"] = firstName as CKRecordValue
      r["expiresAt"] = Date().addingTimeInterval(Self.live) as CKRecordValue
      r["hidden"] = 0 as CKRecordValue
      return try await self.db.save(r).recordID.recordName
    }

    /// Live requests by others, newest first, without the ones three people reported or the reader has hidden.
    AsyncFunction("open") { (skip: [String], limit: Int) async throws -> [[String: Any]] in
      let me = try await self.container.userRecordID()
      let q = CKQuery(recordType: "PrayerRequest", predicate: NSPredicate(format: "expiresAt > %@ AND hidden == 0", Date() as NSDate))
      q.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
      let (results, _) = try await self.db.records(matching: q, resultsLimit: max(limit * 3, 30))
      var out: [CKRecord] = []
      for (_, result) in results {
        guard let r = try? result.get(), r.creatorUserRecordID != me, r["answeredAt"] == nil, !skip.contains(r.recordID.recordName),
              !skip.contains(r.creatorUserRecordID?.recordName ?? "") else { continue }
        out.append(r)
      }
      let reported = try await self.counts(type: "Report", for: out.map(\.recordID))
      return out.filter { (reported[$0.recordID.recordName] ?? 0) < Self.hideAt }.prefix(limit).map(Self.payload)
    }

    AsyncFunction("prayed") { (id: String) async throws in
      let r = CKRecord(recordType: "Prayed")
      r["request"] = CKRecord.Reference(recordID: CKRecord.ID(recordName: id), action: .none)
      _ = try await self.db.save(r)
    }

    /// The reader's own requests, newest first, with how many prayed: only the asker ever sees this count.
    AsyncFunction("mine") { () async throws -> [[String: Any]] in
      let me = try await self.container.userRecordID()
      let q = CKQuery(recordType: "PrayerRequest", predicate: NSPredicate(format: "creatorUserRecordID == %@", CKRecord.Reference(recordID: me, action: .none)))
      q.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
      let (results, _) = try await self.db.records(matching: q, resultsLimit: 50)
      let mine = results.compactMap { try? $0.1.get() }
      let prayed = try await self.counts(type: "Prayed", for: mine.map(\.recordID))
      return mine.map { r in Self.payload(r).merging(["prayed": prayed[r.recordID.recordName] ?? 0]) { $1 } }
    }

    AsyncFunction("markAnswered") { (id: String) async throws in try await self.change(id) { $0["answeredAt"] = Date() as CKRecordValue } }
    AsyncFunction("renew") { (id: String) async throws in try await self.change(id) { $0["expiresAt"] = Date().addingTimeInterval(Self.live) as CKRecordValue } }
    AsyncFunction("remove") { (id: String) async throws in _ = try await self.db.deleteRecord(withID: CKRecord.ID(recordName: id)) }

    /// Requests by id, the ones still there (Pray again's request, PA-01; answered ones you prayed for, PC-23).
    AsyncFunction("fetch") { (ids: [String]) async throws -> [[String: Any]] in
      let found = try await self.db.records(for: ids.prefix(100).map { CKRecord.ID(recordName: $0) })
      return found.values.compactMap { try? $0.get() }.map(Self.payload)
    }

    /// PA-02: CloudKit itself shows the notice when a request you prayed for is marked answered, in fixed words with no
    /// request text, so Yada needs no background code. The id carries the day it was made, so old ones can be pruned.
    AsyncFunction("watchAnswered") { (id: String) async throws in
      let match = NSPredicate(format: "recordID == %@ AND answeredAt > %@", CKRecord.ID(recordName: id), Date(timeIntervalSince1970: 0) as NSDate)
      let s = CKQuerySubscription(recordType: "PrayerRequest", predicate: match, subscriptionID: "answered-\(Int(Date().timeIntervalSince1970))-\(id)", options: [.firesOnRecordUpdate])
      let info = CKSubscription.NotificationInfo()
      info.title = "A prayer you prayed for was answered"
      info.alertBody = "Open Pray to see it."
      info.soundName = "default"
      s.notificationInfo = info
      await MainActor.run { UIApplication.shared.registerForRemoteNotifications() }
      // One watch per request: praying for it again (Pray again) made a second, and two notices (code review, 18 Oct 2026).
      let same = try await self.db.allSubscriptions().map(\.subscriptionID).filter { $0.hasPrefix("answered-") && $0.hasSuffix("-\(id)") }
      let (saved, _) = try await self.db.modifySubscriptions(saving: [s], deleting: same)
      for (_, result) in saved { _ = try result.get() }
    }

    /// Deletes the answered-prayer watches made before `before` (seconds since 1970): all of them when the switch goes
    /// off (PA-03), and the ones older than a request can live otherwise.
    AsyncFunction("unwatchAnswered") { (before: Double) async throws in
      let old = try await self.db.allSubscriptions().map(\.subscriptionID).filter { id in
        let parts = id.split(separator: "-", maxSplits: 2)
        return parts.count == 3 && parts[0] == "answered" && (Double(parts[1]) ?? 0) < before
      }
      for id in old { _ = try? await self.db.deleteSubscription(withID: id) }
    }

    AsyncFunction("report") { (id: String, reason: String) async throws in
      let r = CKRecord(recordType: "Report")
      r["request"] = CKRecord.Reference(recordID: CKRecord.ID(recordName: id), action: .none)
      r["reason"] = reason as CKRecordValue
      _ = try await self.db.save(r)
    }

    /// Remove my data (App Store guideline 5.1.1(v)): every PrayerRequest, Prayed and Report the reader made, found as
    /// `mine` finds requests (creatorUserRecordID, queryable as ___createdBy in schema.ckdb), and their answered-prayer
    /// watches. Throws when any of it could not go, so Settings says so rather than claim it went.
    AsyncFunction("removeMine") { () async throws in
      let me = CKRecord.Reference(recordID: try await self.container.userRecordID(), action: .none)
      var ids: [CKRecord.ID] = []
      for type in ["PrayerRequest", "Prayed", "Report"] {
        let q = CKQuery(recordType: type, predicate: NSPredicate(format: "creatorUserRecordID == %@", me))
        var (results, cursor) = try await self.db.records(matching: q, resultsLimit: CKQueryOperation.maximumResults)
        ids += results.map(\.0)
        while let next = cursor {
          (results, cursor) = try await self.db.records(continuingMatchFrom: next, resultsLimit: CKQueryOperation.maximumResults)
          ids += results.map(\.0)
        }
      }
      // 400 is CloudKit's limit on one modify request. Results carry each failure rather than throwing (YadaCircles.modify).
      for chunk in stride(from: 0, to: ids.count, by: 400).map({ Array(ids[$0..<min($0 + 400, ids.count)]) }) {
        let (_, deleted) = try await self.db.modifyRecords(saving: [], deleting: chunk, savePolicy: .ifServerRecordUnchanged, atomically: false)
        for (_, result) in deleted {
          if case .failure(let error) = result, (error as? CKError)?.code != .unknownItem { throw error }
        }
      }
      let watches = try await self.db.allSubscriptions().map(\.subscriptionID).filter { $0.hasPrefix("answered-") }
      if !watches.isEmpty { _ = try await self.db.modifySubscriptions(saving: [], deleting: watches) }
    }
  }

  private func change(_ id: String, _ edit: (CKRecord) -> Void) async throws {
    let r = try await db.record(for: CKRecord.ID(recordName: id))
    edit(r)
    _ = try await db.save(r)
  }

  /// How many records of `type` point at each request, in one query per 50.
  private func counts(type: String, for ids: [CKRecord.ID]) async throws -> [String: Int] {
    var out: [String: Int] = [:]
    for chunk in stride(from: 0, to: ids.count, by: 50).map({ Array(ids[$0..<min($0 + 50, ids.count)]) }) {
      let refs = chunk.map { CKRecord.Reference(recordID: $0, action: .none) }
      let (results, _) = try await db.records(matching: CKQuery(recordType: type, predicate: NSPredicate(format: "request IN %@", refs)), resultsLimit: CKQueryOperation.maximumResults)
      for (_, result) in results {
        if let ref = (try? result.get())?["request"] as? CKRecord.Reference { out[ref.recordID.recordName, default: 0] += 1 }
      }
    }
    return out
  }

  private static func payload(_ r: CKRecord) -> [String: Any] {
    var p: [String: Any] = [
      "id": r.recordID.recordName,
      "text": r["text"] as? String ?? "",
      "firstName": r["firstName"] as? String ?? "",
      "creator": r.creatorUserRecordID?.recordName ?? "",
      "expiresAt": ((r["expiresAt"] as? Date) ?? Date()).timeIntervalSince1970 * 1000,
    ]
    if let answered = r["answeredAt"] as? Date { p["answeredAt"] = answered.timeIntervalSince1970 * 1000 }
    if let created = r.creationDate { p["createdAt"] = created.timeIntervalSince1970 * 1000 }
    return p
  }
}
