export function blindCast<T>() { return a => (a as T) }

export function assertNever(x: never): never { return x }

export function logIt<T>(msg: string | ((x: T) => string)): (x: T) => T {
  return logItIf(_ => true, msg)
}

export function logItIf<T>(condition: (x: T) => boolean, msg: string | ((x: T) => string)): (x: T) => T {
  return (x) => {
    if (condition(x)) {
      if (typeof msg === "string") {
        console.log(msg);
      } else {
        console.log(msg(x));
      }
    }
    return x
  }
}
