/**
 * One install's App Attest key: a challenge while it is being proved, then its public key and counter.
 * In production each key lives in its own Durable Object (index.ts, by key id), so its counter is exact
 * and no request waits on another install's. This is all that is stored about a device: a random key
 * id, a public key and a number. Nothing about what is read.
 */

import { appleRoot, toB64, fromB64, verifyAssertion, verifyAttestation } from "./verify";

export interface KeyStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
}

/** A challenge is good for five minutes, and once. */
export const CHALLENGE_MS = 5 * 60 * 1000;

interface Challenge {
  readonly value: string;
  readonly expires: number;
}

interface Proved {
  readonly point: string;
  readonly counter: number;
}

export interface KeyDeps {
  readonly storage: KeyStorage;
  readonly appId: string;
  readonly now: () => Date;
  readonly random?: (n: number) => Uint8Array;
  readonly rootDer?: Uint8Array;
}

export class AttestKey {
  constructor(private readonly deps: KeyDeps) {}

  async challenge(): Promise<string> {
    const bytes = (this.deps.random ?? ((n) => crypto.getRandomValues(new Uint8Array(n))))(32);
    const value = toB64(bytes);
    await this.deps.storage.put("challenge", { value, expires: this.deps.now().getTime() + CHALLENGE_MS } satisfies Challenge);
    return value;
  }

  async register(keyId: string, attestation: string): Promise<boolean> {
    const challenge = await this.deps.storage.get<Challenge>("challenge");
    await this.deps.storage.delete("challenge");
    if (challenge === undefined || challenge.expires < this.deps.now().getTime()) return false;
    // A key proved once stays as it is: a second attestation can't reset its counter.
    if ((await this.deps.storage.get<Proved>("key")) !== undefined) return false;
    const proved = await verifyAttestation({ appId: this.deps.appId, rootDer: this.deps.rootDer ?? appleRoot(), now: this.deps.now() }, keyId, challenge.value, attestation);
    if (proved === null) return false;
    await this.deps.storage.put("key", { point: toB64(proved.point), counter: 0 } satisfies Proved);
    return true;
  }

  async assert(clientData: string, assertion: string): Promise<boolean> {
    const key = await this.deps.storage.get<Proved>("key");
    if (key === undefined) return false;
    const counter = await verifyAssertion(this.deps.appId, fromB64(key.point), key.counter, clientData, assertion);
    if (counter === null) return false;
    // Verifying awaits WebCrypto, which lets another request in; read again so the counter only rises.
    const latest = await this.deps.storage.get<Proved>("key");
    if (latest === undefined || latest.counter >= counter) return false;
    await this.deps.storage.put("key", { ...latest, counter } satisfies Proved);
    return true;
  }
}
