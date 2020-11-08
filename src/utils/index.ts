import * as Either from "fp-ts/Either";

export function blindCast<T>() { return a => (a as T) }

export function assertNever(x: never): never { return x }

export function logIt<T>(msg: string | ((x: T) => string), style?: string): (x: T) => T {
  return logItIf(_ => true, msg, style)
}

export function logItIf<T>(condition: (x: T) => boolean, msg: string | ((x: T) => string), style?: string): (x: T) => T {
  const reset = "\x1b[0m";

  return (x) => {
    if (condition(x)) {
      if (typeof msg === "string") {
        console.log(`${style || ""}${msg}${reset}`);
      } else {
        console.log(`${style || ""}${msg(x)}${reset}`);
      }
    }
    return x
  }
}

export function fromEntriesString<A>(entries: [string, A][]): { [key: string]: A } {
  return Object.fromEntries(entries) as { [key: string]: A };
}

export function fromEntriesNumber<A>(entries: [number, A][]): { [key: number]: A } {
  return Object.fromEntries(entries) as { [key: string]: A };
}

export function stableEncode(x: any): string {
  if (Array.isArray(x)) {
    return `[${x.map(e => stableEncode(e)).join(",")}]`
  } else if (typeof x === "object") {
    return `{${Object.keys(x).sort().map(k => `"${k}":${stableEncode(x[k])}`).join(",")}}`
  } else {
    return JSON.stringify(x)
  }
}

const onceCache: Map<string, any> = new Map();

export function once0<X>(id: string, factory: () => X): () => X {
  return () => {
    if (!onceCache.has(id)) {
      onceCache.set(id, factory())
    }
    return onceCache.get(id)
  }
}

export function once1<A, X>(id: string, factory: (a: A) => X): (a: A) => X {
  return (a: A) => {
    if (!onceCache.has(id)) {
      onceCache.set(id, factory(a))
    }
    return onceCache.get(id)
  }
}

export function once2<A, B, X>(id: string, factory: (a: A, b: B) => X): (a: A, b: B) => X {
  return (a: A, b: B) => {
    if (!onceCache.has(id)) {
      onceCache.set(id, factory(a, b))
    }
    return onceCache.get(id)
  }
}

export function eliminateDeep(x: any, target: string[]): any {
  if (Array.isArray(x)) {
    return x.map(e => eliminateDeep(e, target))
  } else if (typeof x === "object") {
    return Object.fromEntries(
      Object.entries(x)
        .filter(([key, _]) => target.filter(x => x === key).length === 0)
        .map(([key, value]) => [key, eliminateDeep(value, target)])
    )
  } else {
    return x
  }
}

export type Lazy<A> = () => A;

export type MaybeLazy<A> = Lazy<A> | A;

export function isLazy<A>(ml: MaybeLazy<A>): ml is () => A {
  return typeof ml === "function" && ml.length === 0
}

export function unlazy<A>(ml: MaybeLazy<A>): A {
  if (isLazy(ml)) {
    return ml()
  } else {
    return ml
  }
}

export function tail<State, Result>(initState: State, f: (s: State) => Either.Either<Result, State>): Result {
  let sor: Either.Either<Result, State> = Either.right(initState);
  while (true) {
    if (Either.isRight(sor)) {
      sor = f(sor.right)
    } else {
      break
    }
  }
  return sor.left
}
