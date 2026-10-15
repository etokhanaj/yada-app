// The listening Live Activity's data (SX-17–23). The same file is in targets/widget: ActivityKit matches the
// type by name, and the widget extension draws it. Keep the two copies identical (systemSurfaces.files.test.ts).
// Mirrors lib/systemSurfaces.ts ActivityState, which the app sends as JSON.

import ActivityKit
import Foundation

public struct ReadingAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// The passage, "The Word became flesh"; the chapter where a book has no passages.
    public var title: String
    /// "1:5".
    public var ref: String
    /// The verse being read, in one of the four open texts (rule 9); empty while the chapter's name is said.
    public var verse: String
    /// SX-19: "John, chapter 2" while the name is said.
    public var spoken: String?
    /// SX-17, SX-18: "Stops after 1:18", "Repeats 1:1–18".
    public var line: String?
    /// "stop" (a moon) or "repeat".
    public var lineGlyph: String?
    /// Each passage's fill, 0 to 1.
    public var segments: [Double]
    /// The playing passage's fill: the Island's ring.
    public var ring: Double
    public var playing: Bool
  }

  public init() {}
}
