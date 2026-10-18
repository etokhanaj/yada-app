// In the app target, not the YadaSystem pod: App Intents are found only in the app's own sources
// (plugins/withAppIntents.js copies this file in at prebuild). The intents a widget or control also runs are in
// YadaSharedIntents.swift.
//
// Siri and App Shortcuts (canvas SX-10, SX-11): "Read Psalm 23 in Yada" answers with the passage in the BSB,
// read in Siri's voice, Read and Listen beneath it; six shortcuts, each a sentence. The BSB only: a licensed
// text never reaches Siri (rule 9).

import AppIntents
import CoreSpotlight
import Foundation
import SQLite3
import SwiftUI

/// The core bundle on this phone: expo-sqlite keeps it in Documents/SQLite as core.vN.db; the newest wins.
enum Core {
  static func path() -> String? {
    guard let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else { return nil }
    let dir = docs.appendingPathComponent("SQLite")
    let files = (try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? []
    let versions = files.compactMap { name -> (Int, String)? in
      guard name.hasPrefix("core.v"), name.hasSuffix(".db"), let v = Int(name.dropFirst(6).dropLast(3)) else { return nil }
      return (v, dir.appendingPathComponent(name).path)
    }
    return versions.max { $0.0 < $1.0 }?.1
  }

  /// Rows of a read-only query, every column as text.
  static func rows(_ sql: String, _ args: [String]) -> [[String]] {
    guard let path = path() else { return [] }
    var db: OpaquePointer?
    // Closed whether or not it opened: a failed open still allocates the handle.
    defer { sqlite3_close(db) }
    guard sqlite3_open_v2(path, &db, SQLITE_OPEN_READONLY, nil) == SQLITE_OK else { return [] }
    var stmt: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
    defer { sqlite3_finalize(stmt) }
    let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    for (i, arg) in args.enumerated() { sqlite3_bind_text(stmt, Int32(i + 1), arg, -1, transient) }
    var out: [[String]] = []
    while sqlite3_step(stmt) == SQLITE_ROW {
      out.append((0..<sqlite3_column_count(stmt)).map { c in sqlite3_column_text(stmt, c).map { String(cString: $0) } ?? "" })
    }
    return out
  }

  /// "john 3 16", "John 3:16", "Psalm 23", "1 Corinthians 13" → its book code, chapter and verse (nil for a
  /// whole chapter): the book's name, or enough of its start to be the first book in canonical order that
  /// begins so ("gen", "1 cor").
  static func parse(_ text: String) -> (code: String, chapter: Int, verse: Int?)? {
    let cleaned = text.lowercased().replacingOccurrences(of: ":", with: " ").replacingOccurrences(of: ".", with: " ")
    let parts = cleaned.split(separator: " ").map(String.init)
    guard parts.count >= 2, let last = Int(parts[parts.count - 1]) else { return nil }
    let verse: Int?
    let chapter: Int
    let bookParts: ArraySlice<String>
    if parts.count >= 3, let c = Int(parts[parts.count - 2]) {
      chapter = c
      verse = last
      bookParts = parts.dropLast(2)
    } else {
      chapter = last
      verse = nil
      bookParts = parts.dropLast(1)
    }
    let bookText = bookParts.joined(separator: " ")
    guard !bookText.isEmpty else { return nil }
    for row in rows("SELECT code, name FROM books ORDER BY ord", []) where row.count == 2 {
      let name = row[1].lowercased()
      if name == bookText || (bookText.count >= 2 && name.hasPrefix(bookText)) || row[0].lowercased() == bookText {
        return (row[0], chapter, verse)
      }
    }
    return nil
  }

  static func bookOrder(_ code: String) -> Int? {
    rows("SELECT ord FROM books WHERE code = ?", [code]).first.flatMap { Int($0[0]) }
  }

  /// "Psalm" for the Psalms, as the app writes a psalm (lib/reader.ts chapterTitle).
  static func bookName(_ code: String) -> String {
    code == "PSA" ? "Psalm" : (rows("SELECT name FROM books WHERE code = ?", [code]).first?.first ?? code)
  }

  /// The BSB verses `from` to `to` of a chapter, as (verse, text).
  static func bsb(_ code: String, _ chapter: Int, from: Int, to: Int) -> [(Int, String)] {
    guard let book = bookOrder(code) else { return [] }
    let base = book * 1_000_000 + chapter * 1000
    return rows("SELECT ord, text FROM texts WHERE translation = 'BSB' AND ord BETWEEN ? AND ? AND text <> '' ORDER BY ord", [String(base + from), String(base + to)])
      .compactMap { r in Int(r[0]).map { ($0 % 1000, r[1]) } }
  }

  static func chapters(_ code: String) -> Int {
    rows("SELECT chapters FROM books WHERE code = ?", [code]).first.flatMap { Int($0[0]) } ?? 0
  }
}

/// A chapter's first passage name, as the app last indexed it (YadaSystemModule indexChapters); nil for a verse,
/// or where the book's passages were not on the phone.
func chapterName(_ id: String) -> String? {
  (UserDefaults(suiteName: yadaGroup)?.dictionary(forKey: "yada.chapterNames") as? [String: String])?[id]
}

/// A chapter ("PSA.23") or a verse ("JHN.3.16"), in the BSB.
@available(iOS 16.0, *)
struct PassageEntity: AppEntity {
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Passage"
  static var defaultQuery = PassageQuery()

  var id: String
  /// "Psalm 23", "John 3:16".
  var reference: String
  var first: String
  /// SX-10, SX-12: "The Lord is my shepherd", for a chapter.
  var name: String? = nil
  /// Spotlight's keywords, "Psalm 23|Psalms 23|PSA 23", as the app writes them (data/system.ts indexSpotlight).
  var searchWords: [String] = []

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(reference)", subtitle: "\(name ?? first)")
  }

  var parts: (code: String, chapter: Int, verse: Int?) {
    let p = id.split(separator: ".").map(String.init)
    return (p.first ?? "", p.count > 1 ? Int(p[1]) ?? 1 : 1, p.count > 2 ? Int(p[2]) : nil)
  }

  static func make(_ code: String, _ chapter: Int, _ verse: Int?) -> PassageEntity? {
    guard chapter >= 1, chapter <= Core.chapters(code) else { return nil }
    let v = verse ?? 1
    guard let text = Core.bsb(code, chapter, from: v, to: v).first?.1 else { return nil }
    let name = Core.bookName(code)
    let reference = verse.map { "\(name) \(chapter):\($0)" } ?? "\(name) \(chapter)"
    let id = verse.map { "\(code).\(chapter).\($0)" } ?? "\(code).\(chapter)"
    return PassageEntity(id: id, reference: reference, first: text, name: verse == nil ? chapterName(id) : nil)
  }
}

/// SX-12 from iOS 18: a chapter in Spotlight as an App Entity, so the hit carries Yada's actions on it, Read
/// (OpenPassageInYadaIntent) and Listen (ListenToPassageIntent). "Psalm 23", "The Lord is my shepherd", the verse.
@available(iOS 18.0, *)
extension PassageEntity: IndexedEntity {
  var attributeSet: CSSearchableItemAttributeSet {
    let attributes = CSSearchableItemAttributeSet(contentType: .text)
    attributes.title = reference
    attributes.displayName = reference
    attributes.contentDescription = name.map { "\($0)\n\(first)" } ?? first
    attributes.keywords = searchWords.isEmpty ? [reference] : searchWords
    // Above the verses (rank 0), as the chapter items were: "psalm 23" finds the psalm first.
    attributes.rankingHint = NSNumber(value: 1)
    return attributes
  }
}

@available(iOS 16.0, *)
struct PassageQuery: EntityStringQuery {
  init() {}

  func entities(for identifiers: [String]) async throws -> [PassageEntity] {
    identifiers.compactMap { id in
      let p = id.split(separator: ".").map(String.init)
      guard p.count >= 2, let c = Int(p[1]) else { return nil }
      return PassageEntity.make(p[0], c, p.count > 2 ? Int(p[2]) : nil)
    }
  }

  func entities(matching string: String) async throws -> [PassageEntity] {
    guard let r = Core.parse(string), let e = PassageEntity.make(r.code, r.chapter, r.verse) else { return [] }
    return [e]
  }

  /// The chapters Siri can hear in "Read Psalm 23 in Yada" (updateAppShortcutParameters): the Psalms, which
  /// "A passage for today" goes through, and John, the book Yada's passages are written for.
  func suggestedEntities() async throws -> [PassageEntity] {
    let ids = (1...150).map { "PSA.\($0)" } + (1...21).map { "JHN.\($0)" }
    return try await entities(for: ids)
  }
}

/// SX-10: Siri reads the passage in the BSB, with Read and Listen beneath it.
@available(iOS 16.0, *)
struct ReadPassageIntent: AppIntent {
  static var title: LocalizedStringResource = "Read a passage"
  static var description = IntentDescription("Reads a chapter or a verse in the Berean Standard Bible.")
  @Parameter(title: "Passage") var passage: PassageEntity

  init() {}

  func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
    let p = passage.parts
    let from = p.verse ?? 1
    let verses = Core.bsb(p.code, p.chapter, from: from, to: p.verse ?? 3)
    let spoken = verses.map(\.1).joined(separator: " ")
    return .result(
      dialog: "\(passage.reference), Berean Standard Bible. \(spoken)",
      view: PassageSnippet(reference: passage.reference, name: p.verse == nil ? passage.name ?? chapterName(passage.id) : nil, id: passage.id, verses: verses)
    )
  }
}

/// SX-10's card: the reference, the passage's name large, the verses in a serif, Read and Listen. Typography
/// carries it; no card chrome.
@available(iOS 16.0, *)
struct PassageSnippet: View {
  let reference: String
  /// "The Lord is my shepherd"; nil for a verse, or where the app has not indexed the names yet.
  let name: String?
  let id: String
  let verses: [(Int, String)]
  @Environment(\.dynamicTypeSize) private var size

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      VStack(alignment: .leading, spacing: 2) {
        Text("\(reference) · BSB").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
        if let name {
          Text(name).font(.system(.title2, design: .serif).weight(.semibold))
        }
      }
      ForEach(size.isAccessibilitySize ? Array(verses.prefix(1)) : verses, id: \.0) { v in
        (Text("\(v.0) ").font(.system(.caption2, design: .serif)).foregroundColor(.secondary) + Text(v.1).font(.system(.body, design: .serif)))
      }
      // Buttons in a Siri snippet act only from iOS 26 (interactive snippets); earlier, they would draw but do
      // nothing, so they are left out and a tap on the snippet opens the passage, as iOS does by default.
      if #available(iOS 26.0, *) {
        HStack(spacing: 10) {
          Button(intent: OpenPassageIntent(id: id)) { Text("Read").frame(minHeight: 44).padding(.horizontal, 8) }
            .buttonStyle(.borderedProminent)
          Button(intent: ListenPassageIntent(id: id)) { Label("Listen", systemImage: "play.fill").frame(minHeight: 44).padding(.horizontal, 8) }
            .buttonStyle(.bordered)
        }
      }
    }
    .padding()
  }
}

/// Read, from Siri's card: the reader at the passage.
@available(iOS 16.0, *)
struct OpenPassageIntent: AppIntent {
  static var title: LocalizedStringResource = "Read in Yada"
  static var isDiscoverable = false
  static var openAppWhenRun = true
  @Parameter(title: "Passage") var id: String

  init() {}
  init(id: String) { self.id = id }

  @MainActor
  func perform() async throws -> some IntentResult {
    Door.open(id.split(separator: ".").count > 2 ? "verse:\(id)" : "chapter:\(id)")
    return .result()
  }
}

/// Listen, from Siri's card: Yada reads the passage aloud without opening.
@available(iOS 17.0, *)
struct ListenPassageIntent: AudioPlaybackIntent {
  static var title: LocalizedStringResource = "Listen in Yada"
  static var isDiscoverable = false
  @Parameter(title: "Passage") var id: String

  init() {}
  init(id: String) { self.id = id }

  func perform() async throws -> some IntentResult {
    let before = Listening.raw()
    Door.open("listen:\(id)")
    await Listening.awaitChange(from: before)
    return .result()
  }
}

/// SX-12's Read: Spotlight's hit opens the reader at the chapter (the entity's open intent from iOS 18), and the
/// same as an App Shortcut, "Open Psalm 23 in Yada".
@available(iOS 16.0, *)
struct OpenPassageInYadaIntent: OpenIntent {
  static var title: LocalizedStringResource = "Read in Yada"
  static var description = IntentDescription("Opens a chapter or a verse in the reader.")
  @Parameter(title: "Passage") var target: PassageEntity

  init() {}

  @MainActor
  func perform() async throws -> some IntentResult {
    Door.open(target.id.split(separator: ".").count > 2 ? "verse:\(target.id)" : "chapter:\(target.id)")
    return .result()
  }
}

/// SX-12's Listen: Spotlight's hit reads the chapter aloud without opening Yada, as Siri's card does. An audio
/// intent from iOS 17 (below), so it may start playback in the background; the App Shortcuts builder takes no
/// availability check, so the type itself is iOS 16.
@available(iOS 16.0, *)
struct ListenToPassageIntent: AppIntent {
  static var title: LocalizedStringResource = "Listen in Yada"
  static var description = IntentDescription("Reads a chapter aloud in the Berean Standard Bible.")
  @Parameter(title: "Passage") var passage: PassageEntity

  init() {}

  func perform() async throws -> some IntentResult {
    let before = Listening.raw()
    Door.open("listen:\(passage.id)")
    await Listening.awaitChange(from: before)
    return .result()
  }
}

@available(iOS 17.0, *)
extension ListenToPassageIntent: AudioPlaybackIntent {}

/// Kept from build 5 so a shortcut someone built on it still runs: one verse, said by Siri.
@available(iOS 16.0, *)
struct ReadVerseIntent: AppIntent {
  static var title: LocalizedStringResource = "Read a verse"
  static var description = IntentDescription("Reads a verse in the Berean Standard Bible.")
  static var isDiscoverable = false
  @Parameter(title: "Verse") var verse: PassageEntity

  init() {}

  func perform() async throws -> some IntentResult & ProvidesDialog & ReturnsValue<String> {
    .result(value: verse.first, dialog: "\(verse.reference), Berean Standard Bible. \(verse.first)")
  }
}

/// "Listen to the next passage": the reader at it, reading aloud in the BSB.
@available(iOS 16.0, *)
struct ListenNextIntent: AppIntent {
  static var title: LocalizedStringResource = "Listen to the next passage"
  static var openAppWhenRun = true
  init() {}

  @MainActor
  func perform() async throws -> some IntentResult {
    Door.open("listen-next")
    return .result()
  }
}

/// "Read today's psalm": A passage for today, in the reader.
@available(iOS 16.0, *)
struct TodaysPsalmIntent: AppIntent {
  static var title: LocalizedStringResource = "Today’s psalm"
  static var description = IntentDescription("Opens the psalm for today.")
  static var openAppWhenRun = true
  init() {}

  @MainActor
  func perform() async throws -> some IntentResult {
    Door.open("today")
    return .result()
  }
}

/// The chapter being heard, "John 1", from "John 1:5".
private func chapterOf(_ l: Listening) -> String {
  l.ref.split(separator: ":").first.map(String.init) ?? l.ref
}

/// SX-11, build 6: "Stop Yada at the end of the chapter", as the player's Stop playing does (LB-02).
@available(iOS 16.0, *)
struct StopAtChapterEndIntent: AppIntent {
  static var title: LocalizedStringResource = "Stop at the end of the chapter"
  static var description = IntentDescription("Stops reading aloud when the chapter ends.")
  init() {}

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard let l = Listening.load() else { return .result(dialog: "Yada isn’t reading aloud.") }
    Door.open("stop:chapter")
    return .result(dialog: "Yada will stop at the end of \(chapterOf(l)).")
  }
}

/// SX-11, build 6: "Repeat this passage", as the player's Repeat does (LB-05).
@available(iOS 16.0, *)
struct RepeatPassageIntent: AppIntent {
  static var title: LocalizedStringResource = "Repeat this passage"
  static var description = IntentDescription("Repeats the passage being read aloud.")
  init() {}

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard Listening.load() != nil else { return .result(dialog: "Yada isn’t reading aloud.") }
    Door.open("repeat:passage")
    return .result(dialog: "Repeating this passage.")
  }
}

@available(iOS 16.0, *)
struct YadaShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(intent: ContinueReadingIntent(), phrases: ["Continue reading in \(.applicationName)"], shortTitle: "Continue reading", systemImageName: "book")
    AppShortcut(intent: ListenNextIntent(), phrases: ["Listen to the next passage in \(.applicationName)"], shortTitle: "Listen to the next passage", systemImageName: "headphones")
    AppShortcut(intent: TodaysPsalmIntent(), phrases: ["Read today's psalm in \(.applicationName)", "Today's psalm in \(.applicationName)"], shortTitle: "Today’s psalm", systemImageName: "play.fill")
    AppShortcut(intent: StopAtChapterEndIntent(), phrases: ["Stop \(.applicationName) at the end of the chapter"], shortTitle: "Stop at the end of the chapter", systemImageName: "moon")
    AppShortcut(intent: RepeatPassageIntent(), phrases: ["Repeat this passage in \(.applicationName)"], shortTitle: "Repeat this passage", systemImageName: "repeat")
    AppShortcut(
      intent: ReadPassageIntent(),
      phrases: ["Read \(\.$passage) in \(.applicationName)", "Read a verse in \(.applicationName)"],
      shortTitle: "Read a verse",
      systemImageName: "magnifyingglass"
    )
    // SX-12: Read and Listen on a chapter, which Spotlight shows beside the chapter's hit.
    AppShortcut(intent: OpenPassageInYadaIntent(), phrases: ["Open \(\.$target) in \(.applicationName)"], shortTitle: "Read", systemImageName: "book")
    AppShortcut(intent: ListenToPassageIntent(), phrases: ["Listen to \(\.$passage) in \(.applicationName)"], shortTitle: "Listen", systemImageName: "play.fill")
  }
}

/// Called by the YadaSystem pod, which cannot name this app-target type: at launch (updateShortcuts), so Siri learns
/// the chapters "Read Psalm 23 in Yada" may name; and from iOS 18 with each batch of chapters (indexChapters).
@objc(YadaShortcutsUpdater)
final class YadaShortcutsUpdater: NSObject {
  @objc static func update() {
    if #available(iOS 16.0, *) { YadaShortcuts.updateAppShortcutParameters() }
  }

  /// SX-12: the chapters as App Entities in Spotlight, each with its passage's name and first verse (BSB, rule 9:
  /// the app sends only the BSB here). Items as data/system.ts indexSpotlight writes them.
  @objc(indexChapters:completion:) static func indexChapters(_ items: NSArray, completion: @escaping (NSError?) -> Void) {
    guard #available(iOS 18.0, *) else { return completion(nil) }
    let entities = items.compactMap { item -> PassageEntity? in
      guard let item = item as? [String: String], let id = item["id"], let title = item["title"], let text = item["text"] else { return nil }
      let name = item["name"].flatMap { $0.isEmpty ? nil : $0 }
      let words = (item["keywords"] ?? "").split(separator: "|").map(String.init)
      return PassageEntity(id: id, reference: title, first: text, name: name, searchWords: words)
    }
    Task(priority: .utility) {
      do {
        try await CSSearchableIndex.default().indexAppEntities(entities)
        completion(nil)
      } catch {
        completion(error as NSError)
      }
    }
  }

  /// Removes the chapters indexed as App Entities (clearIndex, before a new core is indexed).
  @objc(clearChapters:) static func clearChapters(_ completion: @escaping (NSError?) -> Void) {
    guard #available(iOS 18.0, *) else { return completion(nil) }
    Task(priority: .utility) {
      do {
        try await CSSearchableIndex.default().deleteAppEntities(ofType: PassageEntity.self)
        completion(nil)
      } catch {
        completion(error as NSError)
      }
    }
  }
}
