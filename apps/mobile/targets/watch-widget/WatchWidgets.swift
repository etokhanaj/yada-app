// The watch's widgets (AW-01). Today: in the Smart Stack, the mark and "Today", the day's verse in Literata and its
// reference; on a face, the rectangular complication names the day's psalms with the verse's reference under them,
// and the circular one is the mark. This morning: the part's psalms alone. One entry per morning and evening the
// iPhone sent, so each turns over on time without waking anything (no polling). BSB only (rule 9); no streak.

import SwiftUI
import WidgetKit

struct PartEntry: TimelineEntry {
  let date: Date
  let part: WatchPart?

  static let preview = PartEntry(
    date: Date(),
    part: WatchPart(
      from: 0, until: 0, when: "Today",
      verse: WatchVerse(
        text: "He is like a tree planted by streams of water, yielding its fruit in season, whose leaf does not wither, and who prospers in all he does.",
        ref: "Psalm 1:3",
        breathe: nil
      ),
      psalms: WatchPsalms(when: "This morning", label: "Psalms 1–5")
    )
  )
}

struct PartProvider: TimelineProvider {
  func placeholder(in context: Context) -> PartEntry { .preview }

  func getSnapshot(in context: Context, completion: @escaping (PartEntry) -> Void) {
    let data = WatchData.load()
    completion(data == nil && context.isPreview ? .preview : PartEntry(date: Date(), part: data?.part(at: Date())))
  }

  /// Now, then each part as it begins; after the last, nothing until the iPhone sends more and the app reloads us.
  func getTimeline(in context: Context, completion: @escaping (Timeline<PartEntry>) -> Void) {
    let now = Date()
    let parts = WatchData.load()?.parts.filter { $0.end > now } ?? []
    var entries = [PartEntry(date: now, part: parts.first { $0.start <= now })]
    entries += parts.filter { $0.start > now }.map { PartEntry(date: $0.start, part: $0) }
    if let last = parts.last { entries.append(PartEntry(date: last.end, part: nil)) }
    completion(Timeline(entries: entries, policy: .never))
  }
}

// MARK: - Today

struct TodayWidgetView: View {
  let entry: PartEntry
  @Environment(\.widgetFamily) private var family
  /// True in the Smart Stack, false on a watch face.
  @Environment(\.showsWidgetContainerBackground) private var stacked

  var body: some View {
    Group {
      switch family {
      case .accessoryCircular: mark
      default: stacked ? AnyView(stack) : AnyView(face)
      }
    }
    .containerBackground(Color("card"), for: .widget)
  }

  private var mark: some View {
    ZStack {
      AccessoryWidgetBackground()
      YadaMark().fill(Color("accent")).padding(9).widgetAccentable()
    }
    .accessibilityLabel("Yada, opens Today")
  }

  /// AW-01 Smart Stack: the mark and "Today", the verse, the reference.
  @ViewBuilder private var stack: some View {
    if let part = entry.part, let verse = part.verse {
      VStack(alignment: .leading, spacing: 2) {
        HStack(spacing: 4) {
          YadaMark().fill(Color("accent")).frame(width: 14, height: 14).accessibilityHidden(true)
          Text(part.when).font(.caption.weight(.semibold)).foregroundStyle(Color("accent"))
        }
        .widgetAccentable()
        Text("“\(verse.text)”").font(Serif.verse(15, relativeTo: .body)).foregroundStyle(Color("ink")).lineLimit(2)
        Text(verse.ref).font(.caption2).foregroundStyle(Color("mutedInk"))
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .accessibilityElement(children: .combine)
    } else {
      empty
    }
  }

  /// AW-01 face: "Today", the psalms, the verse's reference. With the psalms off, the verse takes their line.
  @ViewBuilder private var face: some View {
    if let part = entry.part, part.verse != nil || part.psalms != nil {
      VStack(alignment: .leading, spacing: 0) {
        Text(part.when).font(.caption2.weight(.semibold)).foregroundStyle(Color("accent")).widgetAccentable()
        if let psalms = part.psalms {
          Text(psalms.label).font(.headline).foregroundStyle(Color("ink"))
        } else if let verse = part.verse {
          Text(verse.text).font(Serif.verse(15, relativeTo: .headline)).foregroundStyle(Color("ink")).lineLimit(1)
        }
        if let verse = part.verse {
          Text(verse.ref).font(.caption2).foregroundStyle(Color("mutedInk"))
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .accessibilityElement(children: .combine)
    } else {
      empty
    }
  }

  private var empty: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text("Today").font(.caption2.weight(.semibold)).foregroundStyle(Color("accent")).widgetAccentable()
      Text("Open Yada on your iPhone.").font(.caption).foregroundStyle(Color("ink"))
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct TodayWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "watch-today", provider: PartProvider()) { TodayWidgetView(entry: $0) }
      .configurationDisplayName("Today")
      .description("The day’s verse and psalms.")
      .supportedFamilies([.accessoryRectangular, .accessoryCircular])
  }
}

// MARK: - This morning's psalms

struct PsalmsWidgetView: View {
  let entry: PartEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      if let psalms = entry.part?.psalms {
        Text(psalms.when).font(.caption.weight(.semibold)).foregroundStyle(Color("accent")).widgetAccentable()
        Text(psalms.label).font(.headline).foregroundStyle(Color("ink"))
      } else if let part = entry.part, let verse = part.verse {
        // Daily psalms Off, or Daily prayer with its own psalms: the day's verse keeps the widget true.
        Text(part.when).font(.caption.weight(.semibold)).foregroundStyle(Color("accent")).widgetAccentable()
        Text(verse.ref).font(.headline).foregroundStyle(Color("ink"))
      } else {
        Text("Open Yada on your iPhone.").font(.caption).foregroundStyle(Color("ink"))
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .accessibilityElement(children: .combine)
    .containerBackground(Color("card"), for: .widget)
  }
}

struct PsalmsWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "watch-psalms", provider: PartProvider()) { PsalmsWidgetView(entry: $0) }
      .configurationDisplayName("Psalms")
      .description("This morning’s or this evening’s psalms.")
      .supportedFamilies([.accessoryRectangular])
  }
}

@main
struct YadaWatchWidgets: WidgetBundle {
  var body: some Widget {
    TodayWidget()
    PsalmsWidget()
  }
}
