import * as Option from "fp-ts/Option";

export class ImmutableMap<K, V> {
  internal: Map<K, V>;

  constructor(entries?: (readonly [K, V])[]) {
    this.internal = new Map(entries);
  }

  has(key: K): boolean {
    return this.internal.has(key)
  }

  add(key: K, value: V): ImmutableMap<K, V> {
    return new ImmutableMap([...this.entries(), [key, value]])
  }

  get(key: K): Option.Option<V> {
    return this.internal.has(key) ? Option.some(this.internal.get(key)) : Option.none
  }

  getMust(key: K): V {
    if (!this.internal.has(key)) {
      throw new Error(`the map does not have entry with key '${JSON.stringify(key)}'`)
    }
    return this.internal.get(key)
  }

  entries(): [K, V][] {
    return Array.from(this.internal.entries())
  }
}

export class ImmutableSet<T> {
  internal: Set<T>;

  constructor(elems?: T[]) {
    this.internal = new Set(elems);
  }

  has(value: T): boolean {
    return this.internal.has(value)
  }

  add(value: T): ImmutableSet<T> {
    return new ImmutableSet([...this.toArray(), value])
  }

  toArray(): T[] {
    return Array.from(this.internal)
  }
}
