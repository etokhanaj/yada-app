// SX-14: the reminder, long-pressed. The passage opens in Yada's serif: overline, its name, the reference, two
// verses in the BSB; iOS adds Read and Listen beneath (the "reading" category's actions). The words come in the
// notification's userInfo (lib/systemSurfaces.ts RichReminder), written by the app when it scheduled it.
// A reminder without them (one scheduled by an older build) shows iOS's own title and body.

import SwiftUI
import UIKit
import UserNotifications
import UserNotificationsUI

struct Rich {
  let overline: String
  let title: String
  let titleLine: String?
  let ref: String
  let verses: [(Int, String)]

  init?(_ info: [AnyHashable: Any]) {
    guard let rich = info["rich"] as? [String: Any],
          let overline = rich["overline"] as? String,
          let title = rich["title"] as? String,
          let ref = rich["ref"] as? String else { return nil }
    self.overline = overline
    self.title = title
    self.ref = ref
    titleLine = rich["titleLine"] as? String
    verses = (rich["verses"] as? [[String: Any]] ?? []).compactMap { v in
      guard let n = v["n"] as? Int, let text = v["text"] as? String, !text.isEmpty else { return nil }
      return (n, text)
    }
  }

  init(fallback content: UNNotificationContent) {
    overline = "Yada"
    title = content.title
    titleLine = nil
    ref = ""
    verses = content.body.isEmpty ? [] : [(0, content.body)]
  }
}

struct RichView: View {
  let rich: Rich
  @Environment(\.dynamicTypeSize) private var size

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      VStack(alignment: .leading, spacing: 2) {
        Text(rich.overline).font(.caption.weight(.medium)).foregroundStyle(Color("mutedInk"))
        Text(rich.title).font(.system(.title3, design: .serif).weight(.semibold)).foregroundStyle(Color("ink"))
        if let line = rich.titleLine {
          Text(line).font(.system(.footnote, design: .serif)).italic().foregroundStyle(Color("mutedInk"))
        }
        if !rich.ref.isEmpty {
          Text(rich.ref).font(.caption).foregroundStyle(Color("mutedInk"))
        }
      }
      // AX5 keeps one verse (SX-14).
      ForEach(Array((size.isAccessibilitySize ? Array(rich.verses.prefix(1)) : rich.verses).enumerated()), id: \.offset) { _, v in
        if v.0 > 0 {
          Text("\(v.0) ").font(.system(.caption2, design: .serif)).foregroundColor(Color("mutedInk"))
            + Text(v.1).font(.system(.body, design: .serif)).foregroundColor(Color("ink"))
        } else {
          Text(v.1).font(.system(.body, design: .serif)).foregroundColor(Color("ink"))
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .fixedSize(horizontal: false, vertical: true)
    .padding(16)
    .accessibilityElement(children: .combine)
  }
}

class NotificationViewController: UIViewController, UNNotificationContentExtension {
  private var host: UIHostingController<RichView>?

  func didReceive(_ notification: UNNotification) {
    let content = notification.request.content
    let rich = Rich(content.userInfo) ?? Rich(fallback: content)
    host?.view.removeFromSuperview()
    host?.removeFromParent()
    let hosting = UIHostingController(rootView: RichView(rich: rich))
    hosting.view.backgroundColor = .clear
    addChild(hosting)
    view.addSubview(hosting.view)
    hosting.view.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      hosting.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      hosting.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      hosting.view.topAnchor.constraint(equalTo: view.topAnchor),
    ])
    hosting.didMove(toParent: self)
    host = hosting
    let width = view.bounds.width > 0 ? view.bounds.width : UIScreen.main.bounds.width - 16
    let fit = hosting.sizeThatFits(in: CGSize(width: width, height: .greatestFiniteMagnitude))
    preferredContentSize = CGSize(width: width, height: fit.height)
  }
}
