import CryptoKit
import DeviceCheck
import ExpoModulesCore

/// App Attest for the licensed proxy (services/licensed-proxy/src/attest): Apple vouches that a request
/// comes from genuine Yada on a real device, so the public source can't be used to spend the API.Bible
/// plan's calls (John, 18 Nov 2026). The flow lives in TypeScript (src/data/attest.ts); this holds the
/// Secure Enclave key and remembers its id once the proxy has accepted it.
///
/// The simulator has no App Attest: `isSupported` is false there and requests go without a proof.
public class YadaAttestModule: Module {
  private let savedKey = "yada.attest.keyId"

  public func definition() -> ModuleDefinition {
    Name("YadaAttest")

    Function("isSupported") { () -> Bool in
      DCAppAttestService.shared.isSupported
    }

    Function("savedKeyId") { () -> String? in
      UserDefaults.standard.string(forKey: self.savedKey)
    }

    Function("saveKeyId") { (keyId: String) in
      UserDefaults.standard.set(keyId, forKey: self.savedKey)
    }

    Function("forgetKeyId") {
      UserDefaults.standard.removeObject(forKey: self.savedKey)
    }

    AsyncFunction("generateKey") { () async throws -> String in
      try await DCAppAttestService.shared.generateKey()
    }

    // Apple wants a hash of the client data; the proxy hashes the same UTF-8 bytes (verify.ts).
    AsyncFunction("attestKey") { (keyId: String, challenge: String) async throws -> String in
      let hash = Data(SHA256.hash(data: Data(challenge.utf8)))
      return try await DCAppAttestService.shared.attestKey(keyId, clientDataHash: hash).base64EncodedString()
    }

    AsyncFunction("generateAssertion") { (keyId: String, clientData: String) async throws -> String in
      let hash = Data(SHA256.hash(data: Data(clientData.utf8)))
      return try await DCAppAttestService.shared.generateAssertion(keyId, clientDataHash: hash).base64EncodedString()
    }
  }
}
