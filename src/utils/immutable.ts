import * as Option from "fp-ts/Option";
import {stableEncode} from "./index";

export class ImmutableMap<K, V> {
  internal: Map<string, V>;
  internalEntries: (readonly [K, V])[];

  constructor(entries?: (readonly [K, V])[], private keyFunc?: (k: K) => any) {
    this.internalEntries = entries || [];
    this.internal = new Map((entries || []).map(([k, v]) => [this.uniqueHashing(k), v]));
  }

  private uniqueHashing(k: K): string {
    return stableEncode((this.keyFunc || ((x: K) => x))(k))
  }

  has(key: K): boolean {
    return this.internal.has(this.uniqueHashing(key))
  }

  add(key: K, value: V): ImmutableMap<K, V> {
    return new ImmutableMap([...this.entries(), [key, value]], this.keyFunc)
  }

  get(key: K): Option.Option<V> {
    const internalKey = this.uniqueHashing(key);
    return this.internal.has(internalKey) ? Option.some(this.internal.get(internalKey)) : Option.none
  }

  getMust(key: K): V {
    if (!this.internal.has(this.uniqueHashing(key))) {
      throw new Error(`the map does not have entry with key '${JSON.stringify(key)}'`)
    }
    return this.internal.get(this.uniqueHashing(key))
  }

  entries(): (readonly [K, V])[] {
    return this.internalEntries
  }
}

export class ImmutableSet<T> {
  internal: Set<string>;
  internalEntries: readonly T[];

  constructor(elems?: readonly T[], private keyFunc?: (x: T) => any) {
    this.internalEntries = elems || [];
    this.internal = new Set((elems || []).map(x => this.uniqueHashing(x)));
  }

  private uniqueHashing(x: T): string {
    return stableEncode((this.keyFunc || ((x: T) => x))(x))
  }

  has(value: T): boolean {
    return this.internal.has(this.uniqueHashing(value))
  }

  add(value: T): ImmutableSet<T> {
    return new ImmutableSet([...this.toArray(), value], this.keyFunc)
  }

  toArray(): readonly T[] {
    return this.internalEntries
  }
}
