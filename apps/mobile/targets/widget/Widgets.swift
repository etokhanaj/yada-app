// Yada's widgets, Lock Screen accessories, controls and the listening Live Activity (canvas SX-01–09, SX-17–23).
// The app writes what they show into the App Group (modules/yada-system setWidgetData, setListening), BSB text
// only: a reader of the NKJV still sees the BSB here (rule 9). One idea across every surface: the passage has a
// name, so the name leads; the reference is the second line; the verse the third. No cards, badges or counts.
//
// The serif is Literata, bundled in the extension (build 8).

import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

// MARK: - Data

struct Verse: Decodable, Hashable {
  let n: Int
  let text: String
}

/// lib/systemSurfaces.ts ContinueData.
struct Place: Decodable {
  let title: String
  let span: String
  let ref: String
  let short: String
  let book: String
  let chapter: Int
  let verse: Int
  let position: Double
  let verses: [Verse]
  let url: String
}

/// lib/systemSurfaces.ts TodayData: one morning's or evening's reading (DR-07).
struct Day: Decodable {
  struct Figure: Decodable {
    let over: String
    let big: String
  }

  let date: String
  let part: String
  let overline: String
  let label: String
  let figure: Figure?
  let book: String
  let chapter: Int
  let verse: Int
  let chapters: [Int]
  let titleLine: String?
  let verses: [Verse]
  let url: String

  var first: String { verses.first?.text ?? "" }
  /// The first verse whole, title and all, as DR-07 draws it on the medium widget.
  var whole: String { titleLine.map { "\($0) \(first)" } ?? first }
}

struct Shared: Decodable {
  let `continue`: Place?
  let today: [Day]

  static func load() -> Shared? {
    guard let json = UserDefaults(suiteName: yadaGroup)?.string(forKey: "widget"), let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(Shared.self, from: data)
  }
}

struct Entry: TimelineEntry {
  let date: Date
  let shared: Shared?
  let listening: Listening?

  var place: Place? { shared?.continue }
  /// Today's reading at this entry's moment: its day turns at 03:00 and its evening starts at 17:00 (lib/today.ts).
  var day: Day? {
    let (key, part) = moment(date)
    return shared?.today.first { $0.date == key && $0.part == part }
  }

  /// Playing in this chapter: the Listen button there is Pause (SX-05).
  func playing(_ book: String, _ chapter: Int) -> Bool {
    playing(book, [chapter])
  }

  /// Playing any of a set's psalms (DR-07): "Psalms 1–5" shows Pause from Psalm 1 to Psalm 5.
  func playing(_ book: String, _ chapters: [Int]) -> Bool {
    guard let l = listening, l.playing else { return false }
    return l.book == book && chapters.contains(l.chapter)
  }

  static let preview = Entry(
    date: Date(),
    shared: Shared(
      continue: Place(
        title: "Healing at the pool", span: "John 5:1–15", ref: "John 5:6", short: "5:6", book: "JHN", chapter: 5, verse: 6, position: 0.4,
        verses: [
          Verse(n: 5, text: "One man there had been an invalid for thirty-eight years."),
          Verse(n: 6, text: "When Jesus saw him lying there and realized that he had spent a long time in this condition, He asked him, “Do you want to get well?”"),
          Verse(n: 7, text: "“Sir,” the invalid replied, “I have no one to help me into the pool when the water is stirred. While I am on my way, someone else goes in before me.”"),
        ],
        url: "studio.yada.reader:///open?book=JHN&chapter=5&verse=6"
      ),
      today: [
        Day(
          date: moment(Date()).key, part: moment(Date()).part, overline: "This morning", label: "Psalms 1–5",
          figure: Day.Figure(over: "Psalms", big: "1–5"), book: "PSA", chapter: 1, verse: 1, chapters: [1, 2, 3, 4, 5], titleLine: nil,
          verses: [
            Verse(n: 1, text: "Blessed is the man who does not walk in the counsel of the wicked, or set foot on the path of sinners, or sit in the seat of mockers."),
            Verse(n: 2, text: "But his delight is in the Law of the LORD, and on His law he meditates day and night."),
            Verse(n: 3, text: "He is like a tree planted by streams of water, yielding its fruit in season, whose leaf does not wither, and who prospers in all he does."),
          ],
          url: "studio.yada.reader:///open?book=PSA&chapter=1&verse=1"
        ),
      ]
    ),
    listening: nil
  )
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> Entry { .preview }
  func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
    let shared = Shared.load()
    completion(shared == nil ? .preview : Entry(date: Date(), shared: shared, listening: Listening.load()))
  }
  /// One entry now and one at each 03:00 and 17:00 for a week (DR-07), so the evening's psalms come at 17:00 and the
  /// next morning's at 03:00 without the app.
  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    let shared = Shared.load()
    let listening = Listening.load()
    let now = Date()
    let start = Calendar.current.startOfDay(for: now)
    let turns = (0...7).flatMap { d -> [Date] in
      [dayTurnsAt, eveningFrom].compactMap { hour in
        Calendar.current.date(byAdding: .day, value: d, to: start).flatMap { Calendar.current.date(bySettingHour: hour, minute: 0, second: 0, of: $0) }
      }
    }
    let entries = [Entry(date: now, shared: shared, listening: listening)] + turns.filter { $0 > now }.map { Entry(date: $0, shared: shared, listening: listening) }
    completion(Timeline(entries: entries, policy: .atEnd))
  }
}

/// lib/today.ts: the day turns at 03:00, the evening starts at 17:00.
let dayTurnsAt = 3
let eveningFrom = 17

/// The day ("2026-11-01") and part ("morning", "evening") Today shows at `date`, as lib/today.ts dayOf and partOf.
func moment(_ date: Date) -> (key: String, part: String) {
  let hour = Calendar.current.component(.hour, from: date)
  let day = hour < dayTurnsAt ? Calendar.current.date(byAdding: .day, value: -1, to: date) ?? date : date
  return (dayKey(day), hour >= eveningFrom || hour < dayTurnsAt ? "evening" : "morning")
}

func dayKey(_ date: Date) -> String {
  let f = DateFormatter()
  f.calendar = Calendar(identifier: .gregorian)
  // Latin digits whatever the phone's locale, to match the keys the app writes.
  f.locale = Locale(identifier: "en_US_POSIX")
  f.dateFormat = "yyyy-MM-dd"
  return f.string(from: date)
}

// MARK: - Type and parts

private enum Fonts {
  static let overline = Font.caption2.weight(.medium)
  static let ref = Font.caption.weight(.semibold)
  // Literata, the app's own scripture face, bundled in the extension (build 8: it was New York before, as the
  // extension had no copy). relativeTo keeps Dynamic Type scaling.
  static func name(_ style: Font.TextStyle) -> Font { .custom("Literata-Regular", size: size(style), relativeTo: style).weight(.semibold) }
  static func verse(_ style: Font.TextStyle) -> Font { .custom("Literata-Regular", size: size(style), relativeTo: style) }
  /// The text style's default point size, so Literata starts where the system serif did.
  private static func size(_ style: Font.TextStyle) -> CGFloat {
    switch style {
    case .largeTitle: return 34
    case .title: return 28
    case .title2: return 22
    case .title3: return 20
    case .headline, .body: return 17
    case .callout: return 16
    case .subheadline: return 15
    case .footnote: return 13
    case .caption: return 12
    case .caption2: return 11
    default: return 17
    }
  }
}

private extension View {
  @ViewBuilder func paper() -> some View {
    if #available(iOS 17.0, *) { containerBackground(Color("paper"), for: .widget) } else { background(Color("paper")) }
  }

  @ViewBuilder func accentable() -> some View {
    if #available(iOS 16.0, *) { widgetAccentable() } else { self }
  }
}

/// SX-01: one hairline showing where the place sits in the passage: a position, never a count.
struct PlaceLine: View {
  let position: Double
  var body: some View {
    GeometryReader { g in
      ZStack(alignment: .leading) {
        Capsule().fill(Color("divider"))
        Capsule().fill(Color("ink")).frame(width: max(2, g.size.width * position)).accentable()
      }
    }
    .frame(height: 2)
    .accessibilityHidden(true)
  }
}

/// A verse with its small number, the reader's way.
struct VerseLine: View {
  let verse: Verse
  let font: Font
  var body: some View {
    (Text("\(verse.n) ").font(.system(.caption2, design: .serif)).foregroundColor(Color("mutedInk")) + Text(verse.text).font(font).foregroundColor(Color("ink")))
  }
}

/// SX-05: Listen without opening Yada; while it plays here, Pause. Its own VoiceOver button, 44 pt.
struct ListenButton: View {
  let what: String
  let playing: Bool
  let label: String
  var body: some View {
    if #available(iOS 17.0, *) {
      Button(intent: ListenIntent(what: what)) {
        Image(systemName: playing ? "pause.fill" : "play.fill")
          .font(.system(size: 15, weight: .bold))
          .foregroundStyle(Color("paper"))
          .frame(width: 44, height: 44)
          .background(Circle().fill(Color("ink")).accentable())
      }
      .buttonStyle(.plain)
      .accessibilityLabel(playing ? "Pause" : label)
    }
  }
}

// MARK: - Continue (SX-01, SX-02, SX-06, SX-07 ring)

struct ContinueView: View {
  let entry: Entry
  @Environment(\.widgetFamily) private var family
  @Environment(\.dynamicTypeSize) private var size

  var body: some View {
    Group {
      if let place = entry.place {
        switch family {
        case .accessoryCircular: ring(place)
        case .systemSmall: small(place)
        case .systemLarge: large(place)
        default: medium(place)
        }
      } else {
        VStack(alignment: .leading, spacing: 4) {
          Text("Continue").font(Fonts.overline).foregroundStyle(Color("mutedInk"))
          Text("Open Yada to start reading.").font(Fonts.verse(.subheadline)).foregroundStyle(Color("ink"))
          Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
    .paper()
    .widgetURL(URL(string: entry.place?.url ?? "studio.yada.reader:///"))
  }

  private func label(_ p: Place) -> String { "Continue, \(p.title), \(p.ref)" }

  private func heading(_ p: Place, _ style: Font.TextStyle, lines: Int) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      Text("Continue").font(Fonts.overline).foregroundStyle(Color("mutedInk"))
      Text(p.title).font(Fonts.name(style)).foregroundStyle(Color("ink")).lineLimit(lines).accentable()
    }
  }

  private func foot(_ p: Place) -> some View {
    let playing = entry.playing(p.book, p.chapter)
    return HStack(alignment: .bottom, spacing: 12) {
      VStack(alignment: .leading, spacing: 6) {
        Text(playing ? "Playing · \(entry.listening.map { "\($0.chapter):\($0.verse)" } ?? p.short)" : "\(p.ref) · BSB")
          .font(Fonts.ref).foregroundStyle(Color("ink"))
        PlaceLine(position: p.position)
      }
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(label(p))
      ListenButton(what: "continue", playing: playing, label: "Listen from \(p.ref)")
    }
  }

  private func small(_ p: Place) -> some View {
    VStack(alignment: .leading, spacing: 0) {
      heading(p, size.isAccessibilitySize ? .title3 : .headline, lines: 3)
      Spacer(minLength: 4)
      Text(p.ref).font(Fonts.ref).foregroundStyle(Color("ink"))
      PlaceLine(position: p.position).padding(.top, 6)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(label(p))
  }

  private func medium(_ p: Place) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      heading(p, .headline, lines: 1)
        .accessibilityHidden(true)
      // AX5: the name and the reference stay; the verse goes (SX-01).
      if !size.isAccessibilitySize, let v = p.verses.first(where: { $0.n == p.verse }) {
        Text(v.text).font(Fonts.verse(.footnote)).foregroundStyle(Color("ink")).lineLimit(2).accessibilityHidden(true)
      }
      Spacer(minLength: 0)
      foot(p)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  /// SX-02: the verses around the place, the place marked as in the reader (wash and a 3 pt bar).
  private func large(_ p: Place) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      VStack(alignment: .leading, spacing: 2) {
        heading(p, .title2, lines: 2)
        Text(p.span).font(.caption).foregroundStyle(Color("mutedInk"))
      }
      .accessibilityHidden(true)
      ViewThatFits(in: .vertical) {
        verses(p, p.verses)
        verses(p, p.verses.filter { $0.n <= p.verse })
        verses(p, p.verses.filter { $0.n == p.verse })
      }
      .accessibilityHidden(true)
      Spacer(minLength: 0)
      foot(p)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private func verses(_ p: Place, _ list: [Verse]) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      ForEach(list, id: \.n) { v in
        if v.n == p.verse {
          HStack(spacing: 0) {
            Rectangle().fill(Color("accent")).frame(width: 3).accentable()
            VerseLine(verse: v, font: Fonts.verse(.subheadline).weight(.medium)).padding(.horizontal, 8).padding(.vertical, 6)
          }
          .background(Color("selection"))
          .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
          .fixedSize(horizontal: false, vertical: true)
        } else {
          VerseLine(verse: v, font: Fonts.verse(.subheadline)).fixedSize(horizontal: false, vertical: true)
        }
      }
    }
  }

  /// SX-07: the place in its passage as a ring, with the verse.
  private func ring(_ p: Place) -> some View {
    Gauge(value: p.position) {
      Text("Continue")
    } currentValueLabel: {
      Text(p.short).font(.system(.body, design: .rounded).weight(.semibold)).minimumScaleFactor(0.6)
    }
    .gaugeStyle(.accessoryCircularCapacity)
    .accessibilityLabel(label(p))
  }
}

// MARK: - Today (DR-07; SX-03, SX-04, SX-06, SX-07, SX-08)

struct TodayView: View {
  let entry: Entry
  @Environment(\.widgetFamily) private var family
  @Environment(\.dynamicTypeSize) private var size

  var body: some View {
    Group {
      if let day = entry.day {
        switch family {
        case .accessoryInline: inline(day)
        case .accessoryRectangular: rectangle(day)
        case .systemSmall: SmallToday(day: day)
        case .systemLarge: large(day)
        default: medium(day)
        }
      } else {
        Text("Open Yada once to bring today’s psalms here.").font(Fonts.verse(.subheadline)).foregroundStyle(Color("ink"))
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      }
    }
    .paper()
    .widgetURL(URL(string: entry.day?.url ?? "studio.yada.reader:///"))
  }

  private func foot(_ d: Day, _ text: String) -> some View {
    let playing = entry.playing(d.book, d.chapters)
    return HStack(alignment: .center, spacing: 12) {
      Text(playing ? "Playing · \(entry.listening.map { "\($0.chapter):\($0.verse)" } ?? "")" : text)
        .font(Fonts.ref).foregroundStyle(Color("ink"))
        .accessibilityHidden(!playing)
      Spacer(minLength: 0)
      ListenButton(what: "today", playing: playing, label: "Listen to \(d.label)")
    }
  }

  /// The BSB's title, "Of David.", set italic above the verse (decision 1): its words, its setting.
  @ViewBuilder private func titleLine(_ d: Day) -> some View {
    if let t = d.titleLine {
      Text(t).font(Fonts.verse(.caption)).italic().foregroundStyle(Color("mutedInk")).lineLimit(1)
    }
  }

  /// DR-07: "This morning", the first verse whole, then "Psalms 1–5 · BSB" beside Listen.
  private func medium(_ d: Day) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      VStack(alignment: .leading, spacing: 4) {
        Text(d.overline).font(Fonts.overline).foregroundStyle(Color("mutedInk"))
        Text(d.whole).font(Fonts.verse(.body)).foregroundStyle(Color("ink")).lineLimit(size.isAccessibilitySize ? 2 : 3)
      }
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(voiceLabel(d))
      Spacer(minLength: 0)
      foot(d, "\(d.label) · BSB")
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private func large(_ d: Day) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      VStack(alignment: .leading, spacing: 8) {
        VStack(alignment: .leading, spacing: 2) {
          Text(d.overline).font(Fonts.overline).foregroundStyle(Color("mutedInk"))
          Text(d.label).font(Fonts.name(.title2)).foregroundStyle(Color("ink")).accentable()
          titleLine(d)
        }
        ViewThatFits(in: .vertical) {
          lines(d.verses)
          lines(Array(d.verses.prefix(2)))
          lines(Array(d.verses.prefix(1)))
        }
      }
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(voiceLabel(d))
      Spacer(minLength: 0)
      foot(d, "BSB")
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private func lines(_ list: [Verse]) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      ForEach(list, id: \.n) { v in VerseLine(verse: v, font: Fonts.verse(.subheadline)).fixedSize(horizontal: false, vertical: true) }
    }
  }

  /// SX-07: "Psalms 6–8 · O LORD, do not rebuke me…".
  private func inline(_ d: Day) -> some View {
    Label("\(d.label) · \(d.first)", systemImage: "book")
      .accessibilityLabel(voiceLabel(d))
  }

  /// SX-07, DR-07 (Lock Screen, evening): the set and its first verse.
  private func rectangle(_ d: Day) -> some View {
    VStack(alignment: .leading, spacing: 1) {
      Text(d.label).font(.headline).widgetAccentable()
      if !size.isAccessibilitySize {
        Text(d.first).font(Fonts.verse(.caption)).lineLimit(2)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(voiceLabel(d))
  }
}

/// DR-07's VoiceOver label: "This evening, Psalms 6–8, O LORD, do not rebuke me…".
private func voiceLabel(_ d: Day) -> String { "\(d.overline), \(d.label), \(d.first)" }

/// SX-03 small, and SX-08: in StandBy, where the container background is gone, the verse fills the widget,
/// the largest thing on the screen after the clock; night mode's red is the system's tint over it.
struct SmallToday: View {
  let day: Day
  @Environment(\.dynamicTypeSize) private var size

  var body: some View {
    if #available(iOS 17.0, *) { Inner(day: day, size: size) } else { Home(day: day, size: size) }
  }

  @available(iOS 17.0, *)
  struct Inner: View {
    let day: Day
    let size: DynamicTypeSize
    @Environment(\.showsWidgetContainerBackground) private var background
    var body: some View {
      if background { Home(day: day, size: size) } else { StandBy(day: day) }
    }
  }

  struct Home: View {
    let day: Day
    let size: DynamicTypeSize
    var body: some View {
      VStack(alignment: .leading, spacing: 0) {
        // SX-03: the psalms' figures set large ("Psalms" over "1–5"); the day's verse has its reference instead.
        if let figure = day.figure {
          Text(figure.over).font(Fonts.overline).foregroundStyle(Color("mutedInk"))
          Text(figure.big).font(.custom("Literata-Regular", size: 46, relativeTo: .largeTitle).weight(.semibold)).foregroundStyle(Color("ink"))
            .lineLimit(1).minimumScaleFactor(0.4).accentable()
        } else {
          Text(day.overline).font(Fonts.overline).foregroundStyle(Color("mutedInk"))
          Text(day.label).font(Fonts.name(.headline)).foregroundStyle(Color("ink")).lineLimit(2).accentable()
        }
        if !size.isAccessibilitySize {
          Spacer(minLength: 4)
          Text(day.first).font(Fonts.verse(.caption)).foregroundStyle(Color("ink")).lineLimit(3)
        }
        Spacer(minLength: 0)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(voiceLabel(day))
    }
  }

  struct StandBy: View {
    let day: Day
    var body: some View {
      VStack(alignment: .leading, spacing: 6) {
        Text(day.label).font(.caption.weight(.medium)).foregroundStyle(.secondary)
        Text(day.first).font(Fonts.verse(.title3)).foregroundStyle(.primary).minimumScaleFactor(0.7)
        Spacer(minLength: 0)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(voiceLabel(day))
    }
  }
}

// MARK: - Listen on the Lock Screen (SX-07)

struct ListenAccessory: View {
  let entry: Entry
  var body: some View {
    let playing = entry.day.map { entry.playing($0.book, $0.chapters) } ?? false
    ZStack {
      AccessoryWidgetBackground()
      if #available(iOS 17.0, *) {
        Button(intent: ListenIntent(what: "today")) {
          Image(systemName: playing ? "pause.fill" : "headphones").font(.title3.weight(.semibold))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(playing ? "Pause" : "Listen to \(entry.day?.label ?? "today’s psalms")")
      } else {
        Image(systemName: "headphones").font(.title3.weight(.semibold)).accessibilityLabel(entry.day?.label ?? "Today’s psalms")
      }
    }
    .widgetURL(URL(string: entry.day?.url ?? "studio.yada.reader:///"))
    .paper()
  }
}

// MARK: - Widgets

struct ContinueWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "continue", provider: Provider()) { ContinueView(entry: $0) }
      .configurationDisplayName("Continue")
      .description("Where you are, one tap back in.")
      .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryCircular])
  }
}

struct TodayWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "today", provider: Provider()) { TodayView(entry: $0) }
      // Build 7 names it Today (docs/build-7-plan.md:106): it follows Settings › Daily psalms as Today does (DR-07).
      .configurationDisplayName("Today")
      .description("This morning’s psalms, then this evening’s.")
      .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryInline, .accessoryRectangular])
  }
}

struct ListenWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "listen", provider: Provider()) { ListenAccessory(entry: $0) }
      .configurationDisplayName("Listen")
      .description("Today’s psalms, read aloud.")
      .supportedFamilies([.accessoryCircular])
  }
}

// MARK: - Control Center (SX-09, iOS 18)

@available(iOS 18.0, *)
struct ListenValue: ControlValueProvider {
  var previewValue: Listening? { nil }
  func currentValue() async throws -> Listening? { Listening.load() }
}

@available(iOS 18.0, *)
struct ListenControl: ControlWidget {
  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: "studio.yada.reader.listen", provider: ListenValue()) { value in
      ControlWidgetToggle("Listen", isOn: value?.playing ?? false, action: ListenToggleIntent()) { on in
        Label(value?.ref ?? "Where you are", systemImage: on ? "pause.fill" : "play.fill")
      }
    }
    .displayName("Listen")
    .description("Plays where you are, without opening Yada.")
  }
}

@available(iOS 18.0, *)
struct ContinueControl: ControlWidget {
  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: "studio.yada.reader.continue") {
      ControlWidgetButton(action: ContinueReadingIntent()) {
        Label("Continue", systemImage: "book")
      }
    }
    .displayName("Continue")
    .description("Opens Yada where you are reading.")
  }
}

// MARK: - The listening Live Activity (SX-17–23)

/// AU-04's segments: one per passage, filled to the verse.
struct Segments: View {
  let fills: [Double]
  var track: Color = Color("divider")
  var fill: Color = Color("ink")
  var body: some View {
    HStack(spacing: 3) {
      ForEach(Array(fills.enumerated()), id: \.offset) { _, f in
        GeometryReader { g in
          ZStack(alignment: .leading) {
            Capsule().fill(track)
            Capsule().fill(fill).frame(width: g.size.width * f)
          }
        }
      }
    }
    .frame(height: 3)
    .accessibilityHidden(true)
  }
}

/// The Island's ring: the playing passage, filled to the verse.
struct PassageRing: View {
  let value: Double
  var body: some View {
    ZStack {
      Circle().stroke(Color.white.opacity(0.25), lineWidth: 2.5)
      Circle().trim(from: 0, to: value).stroke(Color("chartreuse"), style: StrokeStyle(lineWidth: 2.5, lineCap: .round)).rotationEffect(.degrees(-90))
    }
    .frame(width: 18, height: 18)
    .accessibilityHidden(true)
  }
}

/// SX-17: Yada's mark leading the activity's title row, a 24 pt tile on the brand night with the mark in chartreuse,
/// as the app's icon is in either theme (canvas `.sxlam`). Path from the canvas's mark, on a 256 grid.
struct YadaMark: View {
  struct Glyph: Shape {
    func path(in rect: CGRect) -> Path {
      let s = min(rect.width, rect.height) / 256
      let p = { (x: CGFloat, y: CGFloat) in CGPoint(x: rect.minX + x * s, y: rect.minY + y * s) }
      var path = Path()
      path.move(to: p(34, 42))
      path.addCurve(to: p(94, 64), control1: p(62, 40), control2: p(80, 44))
      path.addCurve(to: p(131, 133), control1: p(104, 79), control2: p(115, 101))
      path.addLine(to: p(144, 161))
      path.addCurve(to: p(151, 101), control1: p(146, 139), control2: p(146, 119))
      path.addCurve(to: p(221, 40), control1: p(158, 77), control2: p(181, 53))
      path.addLine(to: p(221, 94))
      path.addCurve(to: p(164, 119), control1: p(191, 94), control2: p(174, 103))
      path.addCurve(to: p(150, 172), control1: p(157, 131), control2: p(154, 152))
      path.addCurve(to: p(99, 227), control1: p(145, 198), control2: p(128, 221))
      path.addCurve(to: p(42, 208), control1: p(75, 232), control2: p(49, 226))
      path.addCurve(to: p(61, 169), control1: p(34, 190), control2: p(43, 171))
      path.addCurve(to: p(91, 196), control1: p(80, 167), control2: p(94, 179))
      path.addCurve(to: p(81, 214), control1: p(90, 204), control2: p(86, 210))
      path.addCurve(to: p(112, 191), control1: p(97, 214), control2: p(108, 205))
      path.addCurve(to: p(105, 155), control1: p(115, 180), control2: p(112, 169))
      path.addLine(to: p(60, 76))
      path.addCurve(to: p(34, 42), control1: p(50, 57), control2: p(43, 47))
      path.closeSubpath()
      return path
    }
  }

  var body: some View {
    Glyph().fill(Color("chartreuse"))
      .frame(width: 16, height: 16)
      .frame(width: 24, height: 24)
      .background(RoundedRectangle(cornerRadius: 6, style: .continuous).fill(Color("mark")))
      .accessibilityHidden(true)
  }
}

/// Previous, play or pause, next by verse; every target at least 44 pt.
struct Controls: View {
  let playing: Bool
  var tint: Color = Color("ink")
  var onTint: Color = Color("paper")
  var body: some View {
    if #available(iOS 17.0, *) {
      HStack(spacing: 4) {
        Button(intent: YadaControlIntent(command: "previous")) {
          Image(systemName: "backward.end.fill").frame(width: 44, height: 44)
        }
        .accessibilityLabel("Previous verse")
        Button(intent: YadaControlIntent(command: "toggle")) {
          Image(systemName: playing ? "pause.fill" : "play.fill").foregroundStyle(onTint).frame(width: 44, height: 44).background(Circle().fill(tint))
        }
        .accessibilityLabel(playing ? "Pause" : "Play")
        Button(intent: YadaControlIntent(command: "next")) {
          Image(systemName: "forward.end.fill").frame(width: 44, height: 44)
        }
        .accessibilityLabel("Next verse")
      }
      .font(.body.weight(.semibold))
      .foregroundStyle(tint)
      .buttonStyle(.plain)
    }
  }
}

struct StatusLine: View {
  let state: ReadingAttributes.ContentState
  var color: Color = Color("mutedInk")
  var body: some View {
    if let line = state.line {
      Label(line, systemImage: state.lineGlyph == "repeat" ? "repeat" : "moon")
        .font(.caption)
        .foregroundStyle(color)
        .lineLimit(1)
    }
  }
}

/// SX-17–19, and SX-22 in StandBy (isActivityFullscreen): the verse fills the screen there.
struct ActivityView: View {
  let state: ReadingAttributes.ContentState
  @Environment(\.dynamicTypeSize) private var size

  var body: some View {
    if #available(iOS 17.0, *) { Inner(state: state, size: size) } else { LockScreen(state: state, size: size) }
  }

  @available(iOS 17.0, *)
  struct Inner: View {
    let state: ReadingAttributes.ContentState
    let size: DynamicTypeSize
    @Environment(\.isActivityFullscreen) private var fullscreen
    var body: some View {
      if fullscreen { StandBy(state: state) } else { LockScreen(state: state, size: size) }
    }
  }

  struct LockScreen: View {
    let state: ReadingAttributes.ContentState
    let size: DynamicTypeSize
    var body: some View {
      VStack(alignment: .leading, spacing: 8) {
        HStack(alignment: .center, spacing: 10) {
          YadaMark()
          Text(state.title).font(Fonts.name(.headline)).foregroundStyle(Color("ink")).lineLimit(2)
          Spacer(minLength: 8)
          Text(state.ref).font(.subheadline.weight(.semibold)).monospacedDigit().foregroundStyle(Color("mutedInk"))
        }
        // SX-19: the chapter's name, in ink, while it is said. AX5 keeps name, line and controls (160 pt cap).
        if let spoken = state.spoken {
          Text(spoken).font(Fonts.name(.subheadline)).foregroundStyle(Color("ink"))
        } else if !size.isAccessibilitySize, !state.verse.isEmpty {
          Text(state.verse).font(Fonts.verse(.subheadline)).foregroundStyle(Color("ink")).lineLimit(2)
        }
        Segments(fills: state.segments)
        HStack {
          StatusLine(state: state)
          Spacer(minLength: 4)
          Controls(playing: state.playing)
        }
      }
      .padding(.horizontal, 16)
      .padding(.vertical, 12)
      .accessibilityElement(children: .contain)
    }
  }

  struct StandBy: View {
    let state: ReadingAttributes.ContentState
    var body: some View {
      HStack(alignment: .center, spacing: 24) {
        VStack(alignment: .leading, spacing: 10) {
          // SX-22: "The Word became flesh · John 1:5": in StandBy nothing else names the book.
          Text("\(state.title) · \(state.reference ?? state.ref)").font(.subheadline.weight(.medium)).foregroundStyle(.secondary)
          Text(state.spoken ?? state.verse).font(Fonts.verse(.largeTitle)).foregroundStyle(.primary).minimumScaleFactor(0.5)
          Segments(fills: state.segments, track: .secondary.opacity(0.3), fill: .primary)
          StatusLine(state: state, color: .secondary)
        }
        Controls(playing: state.playing, tint: .primary, onTint: .black)
      }
      .padding(24)
    }
  }
}

/// SX-20, SX-21: the Island. Compact, the passage ring and the verse; minimal, the ring; expanded, the
/// Lock Screen activity around the camera.
struct ReadingActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: ReadingAttributes.self) { context in
      ActivityView(state: context.state)
        .activityBackgroundTint(Color("paper"))
        .activitySystemActionForegroundColor(Color("ink"))
        .widgetURL(URL(string: "studio.yada.reader:///open?to=player"))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          PassageRing(value: context.state.ring).padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.center) {
          Text(context.state.title).font(Fonts.name(.headline)).foregroundStyle(.white).lineLimit(2).frame(maxWidth: .infinity, alignment: .leading)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(context.state.ref).font(.subheadline.weight(.semibold)).monospacedDigit().foregroundStyle(.white.opacity(0.7))
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 8) {
            if let spoken = context.state.spoken {
              Text(spoken).font(Fonts.name(.subheadline)).foregroundStyle(.white)
            } else if !context.state.verse.isEmpty {
              Text(context.state.verse).font(Fonts.verse(.subheadline)).foregroundStyle(.white).lineLimit(2)
            }
            Segments(fills: context.state.segments, track: .white.opacity(0.2), fill: .white)
            HStack {
              StatusLine(state: context.state, color: .white.opacity(0.7))
              Spacer(minLength: 4)
              Controls(playing: context.state.playing, tint: .white, onTint: .black)
            }
          }
        }
      } compactLeading: {
        PassageRing(value: context.state.ring)
      } compactTrailing: {
        Text(context.state.ref).font(.caption.weight(.semibold)).monospacedDigit().foregroundStyle(Color("chartreuse"))
      } minimal: {
        PassageRing(value: context.state.ring)
      }
      .widgetURL(URL(string: "studio.yada.reader:///open?to=player"))
    }
  }
}

// MARK: - The bundle

@main
struct YadaWidgets: WidgetBundle {
  var body: some Widget {
    ContinueWidget()
    TodayWidget()
    ListenWidget()
    ReadingActivityWidget()
    controls
  }

  @WidgetBundleBuilder private var controls: some Widget {
    if #available(iOS 18.0, *) {
      ListenControl()
      ContinueControl()
    }
  }
}

// MARK: - Previews (decision 6: confirm the sizes here)

#if DEBUG
@available(iOS 17.0, *)
#Preview("Continue small", as: .systemSmall) { ContinueWidget() } timeline: { Entry.preview }
@available(iOS 17.0, *)
#Preview("Continue medium", as: .systemMedium) { ContinueWidget() } timeline: { Entry.preview }
@available(iOS 17.0, *)
#Preview("Continue large", as: .systemLarge) { ContinueWidget() } timeline: { Entry.preview }
@available(iOS 17.0, *)
#Preview("Today small", as: .systemSmall) { TodayWidget() } timeline: { Entry.preview }
@available(iOS 17.0, *)
#Preview("Today medium", as: .systemMedium) { TodayWidget() } timeline: { Entry.preview }
@available(iOS 17.0, *)
#Preview("Today large", as: .systemLarge) { TodayWidget() } timeline: { Entry.preview }
@available(iOS 17.0, *)
#Preview("Lock Screen ring", as: .accessoryCircular) { ContinueWidget() } timeline: { Entry.preview }
@available(iOS 17.0, *)
#Preview("Lock Screen verse", as: .accessoryRectangular) { TodayWidget() } timeline: { Entry.preview }
@available(iOS 17.0, *)
#Preview("Lock Screen inline", as: .accessoryInline) { TodayWidget() } timeline: { Entry.preview }
@available(iOS 17.0, *)
#Preview("Live Activity", as: .content, using: ReadingAttributes()) { ReadingActivityWidget() } contentStates: {
  ReadingAttributes.ContentState(
    title: "The Word became flesh", ref: "1:5", reference: "John 1:5", verse: "The Light shines in the darkness, and the darkness has not overcome it.",
    spoken: nil, line: "Stops after 1:18", lineGlyph: "stop", segments: [5.0 / 18, 0, 0], ring: 5.0 / 18, playing: true
  )
}
#endif
