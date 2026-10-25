import CloudKit
import ExpoModulesCore
import UIKit

/// Circles (build 8 plan §I, decided 17 Oct 2026): a circle is one custom zone in its creator's private database,
/// shared whole with a private CKShare (no public link permission); its requests and prayed marks are records in that
/// zone. Members reach it through the shared database. Only the creator invites (UICloudSharingController), 12 people
/// at most. Records are read with zone changes, so no query indexes are needed.
public class YadaCirclesModule: Module {
  private let container = CKContainer(identifier: "iCloud.studio.yada.reader")
  private static let prefix = "circle-"
  /// Ask someone (Build 12 AO-01 to AO-04): one request shared with one person, a zone of its own that never shows
  /// among circles. Its share opens by its link (publicPermission .readWrite) because the person is reached by a
  /// text, not by their Apple ID; only the link's holder has it, and it ends after 7 days or when answered.
  private static let askPrefix = "ask-"
  static let maxPeople = 12
  /// A share accepted while Yada was opening: JS reads it once it is ready. An ask's entry is "ask-…|owner".
  static var accepted: [String] = []
  static let acceptedNote = Notification.Name("YadaCirclesAccepted")
  private var acceptedObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("YadaCircles")

    /// A share was accepted (a circle's invitation, or an ask's link): JS takes it at once, wherever Yada is.
    Events("onAccepted")

    OnStartObserving {
      self.acceptedObserver = NotificationCenter.default.addObserver(forName: Self.acceptedNote, object: nil, queue: .main) { [weak self] _ in
        self?.sendEvent("onAccepted", [:])
      }
    }

    OnStopObserving {
      if let o = self.acceptedObserver { NotificationCenter.default.removeObserver(o) }
      self.acceptedObserver = nil
    }

    /// Your circles and the ones you joined: id (zone name), name, owned, people. The zones come from the database's
    /// changes, not allRecordZones, which took 15 s on the QA simulator against 0.2 s for each share (24 Oct 2026). The
    /// two databases are read at once, each with its shares in one request.
    AsyncFunction("list") { () async throws -> [[String: Any]] in
      let found = try await withThrowingTaskGroup(of: [[String: Any]].self) { group in
        for (db, owned) in [(self.container.privateCloudDatabase, true), (self.container.sharedCloudDatabase, false)] {
          group.addTask {
            let zones = try await self.zoneIDs(db).filter { $0.zoneName.hasPrefix(Self.prefix) }
            if zones.isEmpty { return [] }
            // One request for every share: several at once never returned on the QA simulator.
            let ids = zones.map { CKRecord.ID(recordName: CKRecordNameZoneWideShare, zoneID: $0) }
            let shares = try await db.records(for: ids)
            return zones.map { zoneID -> [String: Any] in
              let share = (try? shares[CKRecord.ID(recordName: CKRecordNameZoneWideShare, zoneID: zoneID)]?.get()) as? CKShare
              return [
                "id": zoneID.zoneName, "owner": zoneID.ownerName, "owned": owned,
                "name": (share?[CKShare.SystemFieldKey.title] as? String) ?? "Circle",
                "people": share?.participants.filter { $0.acceptanceStatus == .accepted }.count ?? 1,
                "picture": (share?["picture"] as? Int) ?? 0,
              ]
            }
          }
        }
        var all: [[String: Any]] = []
        for try await part in group { all += part }
        return all
      }
      // Mine first, then joined, each by name, so the covers keep their places between loads.
      return found.sorted {
        let (a, b) = ($0["owned"] as? Bool ?? false, $1["owned"] as? Bool ?? false)
        return a != b ? a : ($0["name"] as? String ?? "") < ($1["name"] as? String ?? "")
      }
    }

    /// FL-06 (John, 24 Oct 2026): CloudKit's own notice when a circle you're in has a new request, in fixed words with
    /// no request text and no name (PA-02's rule), so Yada needs no background code. One database subscription in each
    /// database, limited to requests: your own circles live in the private one, the ones you joined in the shared one.
    /// CloudKit sends no notice to the device that saved the request. `on: false` removes both.
    AsyncFunction("watchCircles") { (on: Bool) async throws in
      // Each database on its own: a failure in one must not leave the other without its notice (code review, 24 Oct).
      var failure: Error?
      for db in [self.container.privateCloudDatabase, self.container.sharedCloudDatabase] {
        let id = "circle-requests"
        if !on {
          _ = try? await db.deleteSubscription(withID: id)
          continue
        }
        let s = CKDatabaseSubscription(subscriptionID: id)
        s.recordType = "CircleRequest"
        let info = CKSubscription.NotificationInfo()
        info.title = "A circle has a new request"
        info.alertBody = "Open Pray to pray for it."
        info.soundName = "default"
        s.notificationInfo = info
        do {
          let (saved, _) = try await db.modifySubscriptions(saving: [s], deleting: [])
          for (_, result) in saved { _ = try result.get() }
        } catch {
          failure = error
        }
      }
      if on { await MainActor.run { UIApplication.shared.registerForRemoteNotifications() } }
      if let failure { throw failure }
    }

    /// `picture`: the day picture (1 to 30) the circle keeps as its cover (PC-30, PC-33), stored on its share.
    AsyncFunction("create") { (name: String, picture: Int) async throws -> String in
      let zone = CKRecordZone(zoneName: Self.prefix + UUID().uuidString)
      _ = try await self.container.privateCloudDatabase.save(zone)
      let share = CKShare(recordZoneID: zone.zoneID)
      share[CKShare.SystemFieldKey.title] = name as CKRecordValue
      share["picture"] = picture as CKRecordValue
      share.publicPermission = .none
      _ = try await self.container.privateCloudDatabase.save(share)
      return zone.zoneID.zoneName
    }

    /// The system share sheet with the circle's share, for the creator only; refused at 12 people (PC-04: Messages
    /// first, as iOS offers it). The share stays private to the people invited, and from iOS 26 they cannot add
    /// others: only the creator invites (PC-07, PC-08). UICloudSharingController, used before, offered "Anyone can add
    /// people" and chose it by default (QA, 24 Oct 2026). Resolves when the sheet closes: true only if it was sent.
    AsyncFunction("invite") { (id: String) async throws -> Bool in
      let zoneID = CKRecordZone.ID(zoneName: id, ownerName: CKCurrentUserDefaultName)
      guard let share = try await self.share(in: zoneID, db: self.container.privateCloudDatabase) else { return false }
      if share.participants.count >= Self.maxPeople { return false }
      let options = CKAllowedSharingOptions(allowedParticipantPermissionOptions: .readWrite, allowedParticipantAccessOptions: .specifiedRecipientsOnly)
      if #available(iOS 26.0, *) { options.allowsParticipantsToInviteOthers = false }
      let item = NSItemProvider()
      item.registerCKShare(share, container: self.container, allowedSharingOptions: options)
      return await withCheckedContinuation { (done: CheckedContinuation<Bool, Never>) in
        DispatchQueue.main.async {
          guard let from = self.appContext?.utilities?.currentViewController() else { return done.resume(returning: false) }
          let sheet = UIActivityViewController(activityItems: [item], applicationActivities: nil)
          // Called again if a chosen app hands back to the sheet; a continuation resumes once.
          var answered = false
          sheet.completionWithItemsHandler = { _, completed, _, _ in
            guard !answered else { return }
            answered = true
            done.resume(returning: completed)
          }
          from.present(sheet, animated: true)
        }
      }
    }

    /// Requests in a circle, newest first, each with how many prayed: members see the count, never who (plan §I.3).
    /// Two reports hide a request from the whole circle (§I.8).
    AsyncFunction("requests") { (id: String, owner: String) async throws -> [[String: Any]] in
      let (db, zoneID) = self.place(id, owner)
      let me = try await self.container.userRecordID()
      var requests: [CKRecord] = []
      var prayed: [String: Int] = [:]
      var reports: [String: Int] = [:]
      var cursor: CKServerChangeToken?
      repeat {
        let changes = try await db.recordZoneChanges(inZoneWith: zoneID, since: cursor)
        for (_, result) in changes.modificationResultsByID {
          guard let r = try? result.get().record else { continue }
          if r.recordType == "CircleRequest" { requests.append(r) }
          if r.recordType == "Prayed", let ref = r["request"] as? CKRecord.Reference { prayed[ref.recordID.recordName, default: 0] += 1 }
          if r.recordType == "Report", let ref = r["request"] as? CKRecord.Reference { reports[ref.recordID.recordName, default: 0] += 1 }
        }
        cursor = changes.moreComing ? changes.changeToken : nil
      } while cursor != nil
      return requests.filter { (($0["expiresAt"] as? Date) ?? .distantPast) > Date() && (reports[$0.recordID.recordName] ?? 0) < 2 }
        .sorted { ($0.creationDate ?? .distantPast) > ($1.creationDate ?? .distantPast) }
        .map { r -> [String: Any] in
          let creator = r.creatorUserRecordID
          return [
            "id": r.recordID.recordName, "text": r.encryptedValues["text"] as? String ?? "", "firstName": r.encryptedValues["firstName"] as? String ?? "",
            "creator": creator?.recordName == CKCurrentUserDefaultName ? me.recordName : creator?.recordName ?? "", "mine": creator == me || creator?.recordName == CKCurrentUserDefaultName,
            "expiresAt": ((r["expiresAt"] as? Date) ?? Date()).timeIntervalSince1970 * 1000,
            "prayed": prayed[r.recordID.recordName] ?? 0,
            "createdAt": (r.creationDate ?? Date()).timeIntervalSince1970 * 1000,
          ]
        }
    }

    AsyncFunction("ask") { (id: String, owner: String, text: String, firstName: String) async throws in
      let (db, zoneID) = self.place(id, owner)
      let r = CKRecord(recordType: "CircleRequest", recordID: CKRecord.ID(zoneID: zoneID))
      // Encrypted fields (plan §I.9): readable only by the circle's members, not by Apple or Yada.
      r.encryptedValues["text"] = text
      r.encryptedValues["firstName"] = firstName
      r["expiresAt"] = Date().addingTimeInterval(7 * 24 * 3600) as CKRecordValue
      _ = try await db.save(r)
    }

    /// A report (App Store guideline 1.2): the app hides it from the reporter at once; two hide it from the circle.
    AsyncFunction("report") { (id: String, owner: String, request: String) async throws in
      let (db, zoneID) = self.place(id, owner)
      let r = CKRecord(recordType: "Report", recordID: CKRecord.ID(zoneID: zoneID))
      r["request"] = CKRecord.Reference(recordID: CKRecord.ID(recordName: request, zoneID: zoneID), action: .deleteSelf)
      _ = try await db.save(r)
    }

    /// Renew for 7 more days, or delete: the asker's own requests only (CloudKit refuses anyone else's write).
    AsyncFunction("renew") { (id: String, owner: String, request: String) async throws in
      let (db, zoneID) = self.place(id, owner)
      let r = try await db.record(for: CKRecord.ID(recordName: request, zoneID: zoneID))
      r["expiresAt"] = Date().addingTimeInterval(7 * 24 * 3600) as CKRecordValue
      _ = try await db.save(r)
    }

    AsyncFunction("remove") { (id: String, owner: String, request: String) async throws in
      let (db, zoneID) = self.place(id, owner)
      _ = try await db.deleteRecord(withID: CKRecord.ID(recordName: request, zoneID: zoneID))
    }

    AsyncFunction("prayed") { (id: String, owner: String, request: String) async throws in
      let (db, zoneID) = self.place(id, owner)
      let r = CKRecord(recordType: "Prayed", recordID: CKRecord.ID(zoneID: zoneID))
      r["request"] = CKRecord.Reference(recordID: CKRecord.ID(recordName: request, zoneID: zoneID), action: .deleteSelf)
      _ = try await db.save(r)
    }

    /// The creator deletes the circle for everyone; a member leaves it for themself only.
    AsyncFunction("leave") { (id: String, owner: String) async throws in
      let (db, zoneID) = self.place(id, owner)
      _ = try await db.deleteRecordZone(withID: zoneID)
    }

    /// The people in a circle (PC-05, PC-08): each one's first name as iCloud shares it with the circle, whether they have
    /// joined or are still invited, and which is you. No email or phone number leaves the share.
    AsyncFunction("members") { (id: String, owner: String) async throws -> [[String: Any]] in
      let (db, zoneID) = self.place(id, owner)
      guard let share = try await self.share(in: zoneID, db: db) else { return [] }
      let me = share.currentUserParticipant
      let myName = try await self.container.userRecordID().recordName
      return share.participants.filter { $0.acceptanceStatus != .removed }.map { p in
        // The same id as Self.member gives a record's maker, so a person keeps one colour (PC-05).
        let raw = p.userIdentity.userRecordID?.recordName ?? p.participantID
        let key = raw == CKCurrentUserDefaultName ? myName : raw
        return [
          "id": key,
          "name": p.userIdentity.nameComponents?.givenName ?? "",
          "joined": p.acceptanceStatus == .accepted,
          "creator": p.role == .owner,
          "me": p == me,
        ]
      }
    }

    /// The creator removes someone (PC-08); CloudKit refuses this for anyone else.
    AsyncFunction("removeMember") { (id: String, member: String) async throws in
      let zoneID = CKRecordZone.ID(zoneName: id, ownerName: CKCurrentUserDefaultName)
      guard let share = try await self.share(in: zoneID, db: self.container.privateCloudDatabase),
            let p = share.participants.first(where: { ($0.userIdentity.userRecordID?.recordName ?? $0.participantID) == member }) else { return }
      share.removeParticipant(p)
      _ = try await self.container.privateCloudDatabase.save(share)
    }

    /// The creator renames the circle (PC-06): the share's title is the name everyone sees.
    AsyncFunction("rename") { (id: String, name: String) async throws in
      let zoneID = CKRecordZone.ID(zoneName: id, ownerName: CKCurrentUserDefaultName)
      guard let share = try await self.share(in: zoneID, db: self.container.privateCloudDatabase) else { return }
      share[CKShare.SystemFieldKey.title] = name as CKRecordValue
      _ = try await self.container.privateCloudDatabase.save(share)
    }

    /// What is live in a circle besides its requests (11e): its planned time (PC-17, PC-18), who is coming this week, who
    /// is praying together now and who asked to join them (PC-14, PC-21). One read of the zone's changes.
    AsyncFunction("live") { (id: String, owner: String) async throws -> [String: Any] in
      let (db, zoneID) = self.place(id, owner)
      let me = try await self.container.userRecordID().recordName
      var out: [String: Any] = [:]
      var coming: [[String: Any]] = []
      var together: [[String: Any]] = []
      var cursor: CKServerChangeToken?
      repeat {
        let changes = try await db.recordZoneChanges(inZoneWith: zoneID, since: cursor)
        for (_, result) in changes.modificationResultsByID {
          guard let r = try? result.get().record else { continue }
          let who = Self.member(r, me: me)
          switch r.recordType {
          case "Gathering":
            out["plan"] = [
              "weekday": r["weekday"] as? Int ?? 1, "hour": r["hour"] as? Int ?? 20, "minute": r["minute"] as? Int ?? 0,
              "weekly": (r["weekly"] as? Int ?? 1) == 1, "minutes": r["minutes"] as? Int ?? 20, "once": ((r["once"] as? Date) ?? .distantPast).timeIntervalSince1970 * 1000,
              "by": who, "mine": who == me,
            ] as [String: Any]
          case "Coming":
            coming.append(["member": who, "week": r["week"] as? String ?? "", "going": (r["going"] as? Int ?? 0) == 1, "mine": who == me])
          case "Together":
            together.append(["member": who, "kind": r["kind"] as? String ?? "on", "at": (r.modificationDate ?? .distantPast).timeIntervalSince1970 * 1000, "mine": who == me])
          default: break
          }
        }
        cursor = changes.moreComing ? changes.changeToken : nil
      } while cursor != nil
      out["coming"] = coming
      out["together"] = together
      return out
    }

    /// Plans the circle's one time, or changes it: anyone may plan; only the one who planned it changes it (PC-22), which
    /// the app keeps to. `once` is the first time as one moment, so each phone shows it in its own clock.
    AsyncFunction("plan") { (id: String, owner: String, weekday: Int, hour: Int, minute: Int, weekly: Bool, minutes: Int, once: Double) async throws in
      let (db, zoneID) = self.place(id, owner)
      let rid = CKRecord.ID(recordName: "gathering", zoneID: zoneID)
      let r = (try? await db.record(for: rid)) ?? CKRecord(recordType: "Gathering", recordID: rid)
      r["weekday"] = weekday as CKRecordValue
      r["hour"] = hour as CKRecordValue
      r["minute"] = minute as CKRecordValue
      r["weekly"] = (weekly ? 1 : 0) as CKRecordValue
      r["minutes"] = minutes as CKRecordValue
      r["once"] = Date(timeIntervalSince1970: once / 1000) as CKRecordValue
      _ = try await db.save(r)
    }

    /// Stop planning (PC-22): the time goes for everyone, with who said they'd come.
    AsyncFunction("unplan") { (id: String, owner: String) async throws in
      let (db, zoneID) = self.place(id, owner)
      var ids = [CKRecord.ID(recordName: "gathering", zoneID: zoneID)]
      var cursor: CKServerChangeToken?
      repeat {
        let changes = try await db.recordZoneChanges(inZoneWith: zoneID, since: cursor)
        for (rid, result) in changes.modificationResultsByID where (try? result.get().record.recordType) == "Coming" { ids.append(rid) }
        cursor = changes.moreComing ? changes.changeToken : nil
      } while cursor != nil
      try await self.modify(db, saving: [], deleting: ids)
    }

    /// I'll be there, or can't make it, for one week (PC-18, PC-22). One record per person per week.
    AsyncFunction("coming") { (id: String, owner: String, week: String, going: Bool) async throws in
      let (db, zoneID) = self.place(id, owner)
      let me = try await self.container.userRecordID().recordName
      let rid = CKRecord.ID(recordName: "coming-\(me)-\(week)", zoneID: zoneID)
      let r = (try? await db.record(for: rid)) ?? CKRecord(recordType: "Coming", recordID: rid)
      r["week"] = week as CKRecordValue
      r["going"] = (going ? 1 : 0) as CKRecordValue
      _ = try await db.save(r)
    }

    /// "on" while you pray together, "ask" to join those who are, "off" when you leave: it deletes both of yours.
    AsyncFunction("together") { (id: String, owner: String, kind: String) async throws in
      let (db, zoneID) = self.place(id, owner)
      let me = try await self.container.userRecordID().recordName
      let mine = ["on", "ask"].map { CKRecord.ID(recordName: "together-\($0)-\(me)", zoneID: zoneID) }
      if kind == "off" {
        try await self.modify(db, saving: [], deleting: mine)
        return
      }
      let r = CKRecord(recordType: "Together", recordID: CKRecord.ID(recordName: "together-\(kind)-\(me)", zoneID: zoneID))
      r["kind"] = kind as CKRecordValue
      try await self.modify(db, saving: [r], deleting: [], policy: .allKeys)
    }

    /// Remove my data (App Store guideline 5.1.1(v)): circles the reader made are deleted, for everyone, as `leave`
    /// deletes them; in circles they joined, everything they wrote (requests, prayed marks, reports, plans) is deleted
    /// first, then they leave. Throws on the first failure, so Settings says so rather than claim it went.
    AsyncFunction("removeAll") { () async throws in
      let me = try await self.container.userRecordID()
      let privateDB = self.container.privateCloudDatabase
      for zone in try await privateDB.allRecordZones() where zone.zoneID.zoneName.hasPrefix(Self.prefix) || zone.zoneID.zoneName.hasPrefix(Self.askPrefix) {
        _ = try await privateDB.deleteRecordZone(withID: zone.zoneID)
      }
      let shared = self.container.sharedCloudDatabase
      for zone in try await shared.allRecordZones() where zone.zoneID.zoneName.hasPrefix(Self.prefix) || zone.zoneID.zoneName.hasPrefix(Self.askPrefix) {
        var mine: [CKRecord.ID] = []
        var cursor: CKServerChangeToken?
        repeat {
          let changes = try await shared.recordZoneChanges(inZoneWith: zone.zoneID, since: cursor)
          for (rid, result) in changes.modificationResultsByID {
            guard let r = try? result.get().record, r.recordType != "cloudkit.share" else { continue }
            if r.creatorUserRecordID == me || r.creatorUserRecordID?.recordName == CKCurrentUserDefaultName { mine.append(rid) }
          }
          cursor = changes.moreComing ? changes.changeToken : nil
        } while cursor != nil
        for chunk in stride(from: 0, to: mine.count, by: 400).map({ Array(mine[$0..<min($0 + 400, mine.count)]) }) {
          try await self.modify(shared, saving: [], deleting: chunk)
        }
        _ = try await shared.deleteRecordZone(withID: zone.zoneID)
      }
    }

    /// Ask someone: makes the request's zone and its share, and returns the link that goes in the message.
    /// `to`: the person's name as the asker's contacts have it, kept with the request for the asker's own list.
    AsyncFunction("askOne") { (text: String, to: String) async throws -> [String: Any] in
      let db = self.container.privateCloudDatabase
      let zone = CKRecordZone(zoneName: Self.askPrefix + UUID().uuidString)
      _ = try await db.save(zone)
      let r = CKRecord(recordType: "CircleRequest", recordID: CKRecord.ID(zoneID: zone.zoneID))
      r.encryptedValues["text"] = text
      r.encryptedValues["firstName"] = ""
      r.encryptedValues["to"] = to
      r["expiresAt"] = Date().addingTimeInterval(7 * 24 * 3600) as CKRecordValue
      let share = CKShare(recordZoneID: zone.zoneID)
      share[CKShare.SystemFieldKey.title] = "A prayer request" as CKRecordValue
      share.publicPermission = .readWrite
      // A half-made ask has no id for JS to delete, so it goes here rather than staying in iCloud (review).
      do {
        try await self.modify(db, saving: [r, share], deleting: [])
        let saved = try await self.share(in: zone.zoneID, db: db)
        guard let url = saved?.url else { throw NSError(domain: "YadaCircles", code: 1, userInfo: [NSLocalizedDescriptionKey: "No link for the request"]) }
        return ["id": zone.zoneID.zoneName, "url": url.absoluteString]
      } catch {
        _ = try? await db.deleteRecordZone(withID: zone.zoneID)
        throw error
      }
    }

    /// Your asks of one person, newest first, each with how many times it was prayed for (Your requests, PR-51).
    AsyncFunction("asks") { () async throws -> [[String: Any]] in
      let db = self.container.privateCloudDatabase
      var out: [[String: Any]] = []
      for zoneID in try await self.zoneIDs(db) where zoneID.zoneName.hasPrefix(Self.askPrefix) {
        var request: CKRecord?
        var prayed = 0
        var cursor: CKServerChangeToken?
        repeat {
          let changes = try await db.recordZoneChanges(inZoneWith: zoneID, since: cursor)
          for (_, result) in changes.modificationResultsByID {
            guard let r = try? result.get().record else { continue }
            if r.recordType == "CircleRequest" { request = r }
            if r.recordType == "Prayed" { prayed += 1 }
          }
          cursor = changes.moreComing ? changes.changeToken : nil
        } while cursor != nil
        guard let r = request else { continue }
        out.append([
          "id": zoneID.zoneName, "text": r.encryptedValues["text"] as? String ?? "", "to": r.encryptedValues["to"] as? String ?? "",
          "createdAt": (r.creationDate ?? Date()).timeIntervalSince1970 * 1000,
          "expiresAt": ((r["expiresAt"] as? Date) ?? Date()).timeIntervalSince1970 * 1000,
          "answeredAt": ((r["answeredAt"] as? Date)?.timeIntervalSince1970 ?? 0) * 1000,
          "prayed": prayed,
        ])
      }
      return out.sorted { ($0["createdAt"] as? Double ?? 0) > ($1["createdAt"] as? Double ?? 0) }
    }

    /// Mark your ask answered: it ends for the person asked too.
    AsyncFunction("answerAsk") { (id: String) async throws in
      let (db, zoneID) = self.place(id, "")
      var request: CKRecord?
      // Every page, as asks() reads them: the request may come after many Prayed records (review).
      var cursor: CKServerChangeToken?
      repeat {
        let changes = try await db.recordZoneChanges(inZoneWith: zoneID, since: cursor)
        for (_, result) in changes.modificationResultsByID {
          if let r = try? result.get().record, r.recordType == "CircleRequest" { request = r }
        }
        cursor = changes.moreComing ? changes.changeToken : nil
      } while cursor != nil
      guard let r = request else { throw NSError(domain: "YadaCircles", code: 2, userInfo: [NSLocalizedDescriptionKey: "No request in this ask"]) }
      r["answeredAt"] = Date() as CKRecordValue
      r["expiresAt"] = Date() as CKRecordValue
      try await self.modify(db, saving: [r], deleting: [], policy: .allKeys)
    }

    AsyncFunction("takeAccepted") { () -> [String] in
      defer { Self.accepted.removeAll() }
      return Self.accepted
    }
  }

  /// modifyRecords reports each record's failure in its results, not by throwing, so "Stop planning" failed silently
  /// (code review, 18 Oct 2026). Not atomic, and a record already gone counts as deleted.
  private func modify(_ db: CKDatabase, saving: [CKRecord], deleting: [CKRecord.ID], policy: CKModifyRecordsOperation.RecordSavePolicy = .ifServerRecordUnchanged) async throws {
    let (saved, deleted) = try await db.modifyRecords(saving: saving, deleting: deleting, savePolicy: policy, atomically: false)
    for (_, result) in saved { _ = try result.get() }
    for (_, result) in deleted {
      if case .failure(let error) = result, (error as? CKError)?.code != .unknownItem { throw error }
    }
  }

  /// Who made a record, as `members` names people: in your own zone CloudKit writes you as the default owner.
  private static func member(_ r: CKRecord, me: String) -> String {
    let name = r.creatorUserRecordID?.recordName ?? ""
    return name == CKCurrentUserDefaultName ? me : name
  }

  private func place(_ id: String, _ owner: String) -> (CKDatabase, CKRecordZone.ID) {
    let mine = owner == CKCurrentUserDefaultName || owner.isEmpty
    return (mine ? container.privateCloudDatabase : container.sharedCloudDatabase, CKRecordZone.ID(zoneName: id, ownerName: mine ? CKCurrentUserDefaultName : owner))
  }

  /// Every zone in `db`, from its change feed read from the start.
  private func zoneIDs(_ db: CKDatabase) async throws -> [CKRecordZone.ID] {
    var zones: [CKRecordZone.ID: Bool] = [:]
    var token: CKServerChangeToken?
    while true {
      let changes = try await db.databaseChanges(since: token)
      for m in changes.modifications { zones[m.zoneID] = true }
      for d in changes.deletions { zones[d.zoneID] = nil }
      token = changes.changeToken
      if !changes.moreComing { break }
    }
    return Array(zones.keys)
  }

  private func share(in zoneID: CKRecordZone.ID, db: CKDatabase) async throws -> CKShare? {
    try await db.record(for: CKRecord.ID(recordName: CKRecordNameZoneWideShare, zoneID: zoneID)) as? CKShare
  }

}

/// Expo's app-delegate subscribers do not pass on CloudKit share acceptance, so at launch Yada adds that one method to
/// the app delegate, before iOS can hand it an invitation that opened the app. It accepts the share and tells JS.
public class YadaCirclesAppDelegate: ExpoAppDelegateSubscriber {
  public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    guard let delegate = application.delegate else { return true }
    let selector = #selector(UIApplicationDelegate.application(_:userDidAcceptCloudKitShareWith:))
    let block: @convention(block) (AnyObject, UIApplication, CKShare.Metadata) -> Void = { _, _, metadata in
      let zone = metadata.share.recordID.zoneID
      let op = CKAcceptSharesOperation(shareMetadatas: [metadata])
      // Told to JS once accepted, so the screen it opens can already read the zone (an ask opens straight onto it).
      // Only an acceptance that worked opens a screen: a failed one opened "This request has ended" (review).
      op.acceptSharesResultBlock = { result in
        guard case .success = result else { return }
        DispatchQueue.main.async {
          YadaCirclesModule.accepted.append(zone.zoneName.hasPrefix("ask-") ? "\(zone.zoneName)|\(zone.ownerName)" : zone.zoneName)
          NotificationCenter.default.post(name: YadaCirclesModule.acceptedNote, object: nil)
        }
      }
      CKContainer(identifier: metadata.containerIdentifier).add(op)
    }
    class_addMethod(type(of: delegate), selector, imp_implementationWithBlock(block), "v@:@@")
    return true
  }
}
