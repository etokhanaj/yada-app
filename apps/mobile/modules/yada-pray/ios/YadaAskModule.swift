import ContactsUI
import ExpoModulesCore
import MessageUI
import UIKit

/// Ask someone's three system sheets (Build 12 AO-02, AO-03): iOS's own contact picker, which hands Yada only the one
/// person chosen and needs no access to the contacts (so Yada never asks for it); Messages with the words filled in;
/// and the share sheet for other ways to send. Each resolves when its sheet closes.
public class YadaAskModule: Module {
  private var picking: PickerDelegate?
  private var composing: ComposeDelegate?

  public func definition() -> ModuleDefinition {
    Name("YadaAsk")

    /// The person chosen, or null if the picker was closed: their name and phone numbers and emails, nothing else.
    AsyncFunction("pickPerson") { (promise: Promise) in
      DispatchQueue.main.async {
        guard let from = self.appContext?.utilities?.currentViewController() else { return promise.resolve(nil) }
        let picker = CNContactPickerViewController()
        picker.displayedPropertyKeys = [CNContactPhoneNumbersKey, CNContactEmailAddressesKey]
        let delegate = PickerDelegate { contact in
          self.picking = nil
          guard let c = contact else { return promise.resolve(nil) }
          promise.resolve([
            "name": [c.givenName, c.familyName].filter { !$0.isEmpty }.joined(separator: " "),
            "first": c.givenName,
            "phones": c.phoneNumbers.map { $0.value.stringValue },
            "emails": c.emailAddresses.map { $0.value as String },
          ])
        }
        self.picking = delegate
        picker.delegate = delegate
        from.present(picker, animated: true)
      }
    }

    /// Messages, to the person, with the words in; "sent", "cancelled", or "unavailable" when the phone can't text.
    AsyncFunction("sendText") { (to: [String], body: String, promise: Promise) in
      DispatchQueue.main.async {
        guard MFMessageComposeViewController.canSendText(), let from = self.appContext?.utilities?.currentViewController() else { return promise.resolve("unavailable") }
        let sheet = MFMessageComposeViewController()
        sheet.recipients = to
        sheet.body = body
        let delegate = ComposeDelegate { result in
          self.composing = nil
          promise.resolve(result == .sent ? "sent" : "cancelled")
        }
        self.composing = delegate
        sheet.messageComposeDelegate = delegate
        from.present(sheet, animated: true)
      }
    }

    /// The share sheet with the words: Mail, WhatsApp, or anything else the phone has. True if it went.
    AsyncFunction("shareText") { (body: String, promise: Promise) in
      DispatchQueue.main.async {
        guard let from = self.appContext?.utilities?.currentViewController() else { return promise.resolve(false) }
        let sheet = UIActivityViewController(activityItems: [body], applicationActivities: nil)
        var answered = false
        sheet.completionWithItemsHandler = { _, completed, _, _ in
          guard !answered else { return }
          answered = true
          promise.resolve(completed)
        }
        from.present(sheet, animated: true)
      }
    }
  }
}

final class PickerDelegate: NSObject, CNContactPickerDelegate {
  private let done: (CNContact?) -> Void
  init(done: @escaping (CNContact?) -> Void) { self.done = done }
  func contactPicker(_ picker: CNContactPickerViewController, didSelect contact: CNContact) { done(contact) }
  func contactPickerDidCancel(_ picker: CNContactPickerViewController) { done(nil) }
}

final class ComposeDelegate: NSObject, MFMessageComposeViewControllerDelegate {
  private let done: (MessageComposeResult) -> Void
  init(done: @escaping (MessageComposeResult) -> Void) { self.done = done }
  func messageComposeViewController(_ controller: MFMessageComposeViewController, didFinishWith result: MessageComposeResult) {
    controller.dismiss(animated: true)
    done(result)
  }
}
