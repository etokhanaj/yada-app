// The watch app's one page: the Smart Stack's Today opened (AW-01: the day's verse, its reference, this part's
// psalms), then Sit with this's three steps on the wrist (AW-03). No frame draws this page itself; it carries the
// AW-01 widget's words and type in a watchOS list (Apple's Mindfulness and Weather open their Smart Stack widget
// the same way, Mobbin, watchOS). No streak, no count (AW-01).

import SwiftUI

struct TodayView: View {
  @EnvironmentObject private var store: WatchStore
  /// The step and its verse, taken when the session starts: a part boundary passing mid-session must not empty the
  /// cover, and the new part may have no verse (native review, 18 Oct 2026).
  @State private var sitting: Sitting?

  var body: some View {
    // Redrawn only when a part begins or ends, the moments the iPhone sent.
    TimelineView(.explicit(boundaries)) { context in
      let part = store.data?.part(at: context.date)
      List {
        if let part {
          day(part)
          if let verse = part.verse { sit(verse) }
        } else {
          Text("Open Yada on your iPhone.")
            .font(.body)
            .foregroundStyle(Color("mutedInk"))
            .listRowBackground(Color.clear)
        }
      }
      .fullScreenCover(item: $sitting) { s in
        SitView(step: s.step, verse: s.verse)
      }
    }
    .navigationTitle("Yada")
  }

  private var boundaries: [Date] {
    (store.data?.parts ?? []).flatMap { [$0.start, $0.end] }.filter { $0 > Date() }
  }

  @ViewBuilder private func day(_ part: WatchPart) -> some View {
    if let verse = part.verse {
      VStack(alignment: .leading, spacing: 4) {
        Text(part.when).font(.footnote.weight(.semibold)).foregroundStyle(Color("accent"))
        Text("“\(verse.text)”").font(Serif.verse(18, relativeTo: .body)).foregroundStyle(Color("ink"))
        Text(verse.ref).font(.footnote).foregroundStyle(Color("mutedInk"))
      }
      .accessibilityElement(children: .combine)
      .listRowBackground(Color.clear)
    }
    if let psalms = part.psalms {
      VStack(alignment: .leading, spacing: 2) {
        Text(psalms.when).font(.footnote.weight(.semibold)).foregroundStyle(Color("accent"))
        Text(psalms.label).font(.headline).foregroundStyle(Color("ink"))
      }
      .accessibilityElement(children: .combine)
      .listRowBackground(Color.clear)
    }
  }

  private func sit(_ verse: WatchVerse) -> some View {
    Section("Sit with this") {
      ForEach(Step.allCases.filter { $0 != .breathe || verse.halves != nil }) { step in
        Button(step.title) { sitting = Sitting(step: step, verse: verse) }
          .foregroundStyle(Color("ink"))
          .listRowBackground(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(Color("card")))
      }
    }
  }
}

struct Sitting: Identifiable {
  let step: Step
  let verse: WatchVerse
  var id: String { step.id }
}
