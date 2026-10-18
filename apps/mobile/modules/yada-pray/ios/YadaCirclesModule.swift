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
  static let maxPeople = 12
  /// A share accepted while Yada was opening: JS reads it once it is ready.
  static var accepted: [String] = []

  public func definition() -> ModuleDefinition {
    Name("YadaCircles")

    /// Your circles and the ones you joined: id (zone name), name, owned, people.
    AsyncFunction("list") { () async throws -> [[String: Any]] in
      var out: [[String: Any]] = []
      for (db, owned) in [(self.container.privateCloudDatabase, true), (self.container.sharedCloudDatabase, false)] {
        for zone in try await db.allRecordZones() where zone.zoneID.zoneName.hasPrefix(Self.prefix) {
          let share = try? await self.share(in: zone.zoneID, db: db)
          out.append([
            "id": zone.zoneID.zoneName, "owner": zone.zoneID.ownerName, "owned": owned,
            "name": (share?[CKShare.SystemFieldKey.title] as? String) ?? "Circle",
            "people": share?.participants.filter { $0.acceptanceStatus == .accepted }.count ?? 1,
          ])
        }
      }
      return out
    }

    AsyncFunction("create") { (name: String) async throws -> String in
      let zone = CKRecordZone(zoneName: Self.prefix + UUID().uuidString)
      _ = try await self.container.privateCloudDatabase.save(zone)
      let share = CKShare(recordZoneID: zone.zoneID)
      share[CKShare.SystemFieldKey.title] = name as CKRecordValue
      share.publicPermission = .none
      _ = try await self.container.privateCloudDatabase.save(share)
      return zone.zoneID.zoneName
    }

    /// The system's invite sheet, for the creator only; refused at 12 people.
    AsyncFunction("invite") { (id: String) async throws -> Bool in
      let zoneID = CKRecordZone.ID(zoneName: id, ownerName: CKCurrentUserDefaultName)
      guard let share = try await self.share(in: zoneID, db: self.container.privateCloudDatabase) else { return false }
      if share.participants.count >= Self.maxPeople { return false }
      await MainActor.run {
        let sheet = UICloudSharingController(share: share, container: self.container)
        sheet.availablePermissions = [.allowPrivate, .allowReadWrite]
        self.appContext?.utilities?.currentViewController()?.present(sheet, animated: true)
      }
      return true
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
            "creator": creator?.recordName ?? "", "mine": creator == me || creator?.recordName == CKCurrentUserDefaultName,
            "expiresAt": ((r["expiresAt"] as? Date) ?? Date()).timeIntervalSince1970 * 1000,
            "prayed": prayed[r.recordID.recordName] ?? 0,
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

    AsyncFunction("takeAccepted") { () -> [String] in
      defer { Self.accepted.removeAll() }
      return Self.accepted
    }
  }

  private func place(_ id: String, _ owner: String) -> (CKDatabase, CKRecordZone.ID) {
    let mine = owner == CKCurrentUserDefaultName || owner.isEmpty
    return (mine ? container.privateCloudDatabase : container.sharedCloudDatabase, CKRecordZone.ID(zoneName: id, ownerName: mine ? CKCurrentUserDefaultName : owner))
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
      CKContainer(identifier: metadata.containerIdentifier).add(CKAcceptSharesOperation(shareMetadatas: [metadata]))
      YadaCirclesModule.accepted.append(metadata.share.recordID.zoneID.zoneName)
    }
    class_addMethod(type(of: delegate), selector, imp_implementationWithBlock(block), "v@:@@")
    return true
  }
}
