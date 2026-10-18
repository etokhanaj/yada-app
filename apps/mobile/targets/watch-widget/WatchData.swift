// What the watch app and its widgets share (AW-01, AW-03): the parts the iPhone sends (lib/systemSurfaces.ts
// WatchPart), the App Group on the watch where the app keeps them for the widgets, Yada's mark and the serif.
// Kept identical in targets/watch and targets/watch-widget (systemSurfaces.files.test.ts).

import SwiftUI

/// The App Group on the watch: the iPhone's group of the same name lives on another device.
let watchGroup = "group.studio.yada.reader"
let watchKey = "watch"

struct WatchVerse: Decodable, Hashable {
  let text: String
  /// "Psalm 1:3".
  let ref: String
  /// Breathe the verse's two halves, or nil where the verse has no break of its own (lib/sit.ts breathSplit).
  let breathe: [String]?
}

struct WatchPsalms: Decodable, Hashable {
  /// "This morning".
  let when: String
  /// "Psalms 1–5".
  let label: String
}

/// One morning or evening: from 03:00 or 17:00 (lib/today.ts).
struct WatchPart: Decodable, Hashable {
  let from: Double
  let until: Double
  /// "Today" or "This evening".
  let when: String
  let verse: WatchVerse?
  let psalms: WatchPsalms?

  var start: Date { Date(timeIntervalSince1970: from / 1000) }
  var end: Date { Date(timeIntervalSince1970: until / 1000) }
}

struct WatchData: Decodable {
  let parts: [WatchPart]

  func part(at date: Date) -> WatchPart? {
    parts.first { $0.start <= date && date < $0.end }
  }

  static func decode(_ json: String) -> WatchData? {
    json.data(using: .utf8).flatMap { try? JSONDecoder().decode(WatchData.self, from: $0) }
  }

  static func load() -> WatchData? {
    UserDefaults(suiteName: watchGroup)?.string(forKey: watchKey).flatMap(decode)
  }
}

enum Serif {
  /// Literata, the app's scripture face, bundled in each target; relativeTo keeps Dynamic Type scaling.
  static func verse(_ size: CGFloat, relativeTo style: Font.TextStyle) -> Font {
    .custom("Literata-Regular", size: size, relativeTo: style)
  }
}

/// Yada's mark (brand/, the frames' app icon), drawn in a 256-unit square.
struct YadaMark: Shape {
  func path(in rect: CGRect) -> Path {
    let s = min(rect.width, rect.height) / 256
    let o = CGPoint(x: rect.midX - 128 * s, y: rect.midY - 128 * s)
    func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: o.x + x * s, y: o.y + y * s) }
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
