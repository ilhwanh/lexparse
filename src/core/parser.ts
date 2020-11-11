import * as Either from "fp-ts/Either";
import * as Arr from "fp-ts/Array";
import {pipe} from "fp-ts/function";
import {assertNever, logItIf, MaybeLazy, unlazy} from "../utils";
import {ImmutableMap, ImmutableSet} from "../utils/immutable";
import {FIFOArray} from "./lexer";
import * as Option from "fp-ts/Option";

type ParseError = Error;


export interface Parser<Token extends { uid: number; contents: string; }, Variant> {
  parse(tokens: Token[]): Either.Either<ParseError, Ast<Variant>>
}

export type Declaration<Variant> =
  | DeclarationObject<Variant>
  | DeclarationArray<Variant>
  | DeclarationLiteral
  | DeclarationUnion<Variant>
  | DeclarationSequence<Variant>
  | DeclarationMapper<Variant>;

type DeclarationObject<Variant> = {
  uid: number;
  type: "object";
  variant: Variant;
  entries: DeclarationObjectEntry<Variant>[];
};

type DeclarationArray<Variant> = {
  uid: number;
  type: "array";
  element: MaybeLazy<Declaration<Variant>>;
  atLeast?: number;
  atMost?: number;
};

type DeclarationLiteral = {
  uid: number;
  type: "literal";
  token: DeclarationToken;
  mapper?: (x: string) => AstLiteral;
};

type DeclarationUnion<Variant> = {
  uid: number;
  type: "union";
  ordered: boolean;
  elements: MaybeLazy<Declaration<Variant>>[];
};

type DeclarationSequence<Variant> = {
  uid: number;
  type: "sequence";
  elements: MaybeLazy<Declaration<Variant>>[];
};

type DeclarationMapper<Variant> = {
  uid: number;
  type: "mapper";
  subDec: MaybeLazy<Declaration<Variant>>;
  mapper: (x: Ast<Variant>) => Ast<Variant>[];
};

namespace Declaration {
  export function apply<Variant, Y>(
    fObj: (x: DeclarationObject<Variant>) => Y,
    fArray: (x: DeclarationArray<Variant>) => Y,
    fLiteral: (x: DeclarationLiteral) => Y,
    onUnion: (x: Declaration<Variant>[], ordered: boolean) => Y,
    onSequence: (x: Declaration<Variant>[]) => Y,
    fMapper: (x: DeclarationMapper<Variant>) => Y,
  ): (dec: Declaration<Variant>) => Y {
    return (dec: Declaration<Variant>) => {
      if (dec.type === "object") {
        return fObj(dec)
      } else if (dec.type === "array") {
        return fArray(dec)
      } else if (dec.type === "literal") {
        return fLiteral(dec)
      } else if (dec.type === "union") {
        return onUnion(dec.elements.map(unlazy), dec.ordered)
      } else if (dec.type === "sequence") {
        return onSequence(dec.elements.map(unlazy))
      } else if (dec.type === "mapper") {
        return fMapper(dec)
      } else {
        assertNever(dec);
      }
    }
  }

  export function debugName<Variant>(dec: Declaration<Variant>): string {
    return apply(
      dec => `object: ${dec.variant}`,
      dec => `array[${dec.atLeast || 0}:${dec.atMost || -1}]: (${debugName(unlazy(dec.element))})`,
      dec => `literal: ${dec.uid}`,
      (arr, ordered) => (ordered ? "either " : "") + arr.map(unlazy).map(debugName).map(x => `(${x})`).join(" or "),
      arr => arr.map(unlazy).map(debugName).map(x => `(${x})`).join("->"),
      dec => `mapped: (${debugName(unlazy(dec.subDec))})`
    )(dec)
  }
}

type DeclarationObjectEntry<Variant> = [string | undefined, MaybeLazy<Declaration<Variant>>];

type DeclarationToken = {
  uid: number;
  pattern?: RegExp;
}

let declarationUid = 0;


export function objectDec<Variant>(variant: Variant, ...entries: DeclarationObjectEntry<Variant>[]): Declaration<Variant> {
  return {
    uid: declarationUid++,
    type: "object",
    variant: variant,
    entries: entries,
  }
}

export function zeroOrMore<Variant>(element: MaybeLazy<Declaration<Variant>>): Declaration<Variant> {
  return {
    uid: declarationUid++,
    type: "array",
    element: element,
  }
}

export function oneOrMore<Variant>(element: MaybeLazy<Declaration<Variant>>): Declaration<Variant> {
  return {
    uid: declarationUid++,
    type: "array",
    element: element,
    atLeast: 1,
  }
}

export function optional<Variant>(element: MaybeLazy<Declaration<Variant>>): Declaration<Variant> {
  return mapped(
    (ast) => Array.isArray(ast) ? [ast[0]] : [undefined],
    {
      uid: declarationUid++,
      type: "array",
      element: element,
      atMost: 1,
    },
  )
}

export function delimitedArray<Variant>(element: MaybeLazy<Declaration<Variant>>, delimiter: MaybeLazy<Declaration<Variant>>): Declaration<Variant> {
  return mapped(
    (ast) => typeof ast === "undefined" ? [[]] : [[ast[0], ...ast[1].map(subseq => subseq[1])]],
    optional(sequence(element, zeroOrMore(sequence(delimiter, element))))
  )
}

export function repeat<Variant>(atLeast: number, atMost: number, element: MaybeLazy<Declaration<Variant>>): Declaration<Variant> {
  return {
    uid: declarationUid++,
    type: "array",
    element: element,
    atLeast: atLeast,
    atMost: atMost,
  }
}

export function literalDec<Variant>(token: { uid: number }, pattern?: RegExp, mapper?: (x: string) => AstLiteral): Declaration<Variant> {
  return {
    uid: declarationUid++,
    type: "literal",
    token: {
      uid: token.uid,
      pattern: pattern,
    },
    mapper: mapper,
  }
}

export function either<Variant>(...elements: (MaybeLazy<Declaration<Variant>>)[]): Declaration<Variant> {
  return {
    uid: declarationUid++,
    type: "union",
    ordered: true,
    elements: elements,
  }
}

export function union<Variant>(...elements: (MaybeLazy<Declaration<Variant>>)[]): Declaration<Variant> {
  return {
    uid: declarationUid++,
    type: "union",
    ordered: false,
    elements: elements,
  }
}

export function sequence<Variant>(...elements: (MaybeLazy<Declaration<Variant>>)[]): Declaration<Variant> {
  return {
    uid: declarationUid++,
    type: "sequence",
    elements: elements,
  }
}

export function mapped<Variant>(mapper: (x: Ast<Variant>) => Ast<Variant>[], subDec: MaybeLazy<Declaration<Variant>>): Declaration<Variant> {
  return {
    uid: declarationUid++,
    type: "mapper",
    subDec: subDec,
    mapper: mapper,
  }
}

export function slice<Variant>(from: number, to: number | undefined, subDec: MaybeLazy<Declaration<Variant>>): Declaration<Variant> {
  const indexHelper = (arr: any[]) => (index: number) => typeof index === "number" ? (index >= 0 ? index : arr.length + index) : arr.length;
  return mapped(
    (ast) => Array.isArray(ast) ? [ast.slice(indexHelper(ast)(from), indexHelper(ast)(to))] : [],
    subDec,
  )
}

export function pick<Variant>(index: number, subDec: MaybeLazy<Declaration<Variant>>): Declaration<Variant> {
  return mapped(
    (ast) => Array.isArray(ast) ? [ast[index]] : [],
    subDec,
  )
}

type Ast<Variant> = AstLiteral | AstArray<Variant> | AstObject<Variant>;
type AstLiteral = undefined | boolean | string | number;
type AstArray<Variant> = FIFOArray<Ast<Variant>>;
type AstObject<Variant> = { type: Variant; data: { [key: string]: Ast<Variant>; }; };

export type DeclarationParserEnv<LexToken, Variant> = ImmutableMap<
  number,
  (ctx: DeclarationParserContext<LexToken, Variant>) =>
    (input: FIFOArray<LexToken>) =>
      DeclarationParserInterpretResult<LexToken, Ast<Variant>>
>;

type DeclarationParserInterpretResult<LexToken, T> = {
  input: FIFOArray<LexToken>;
  output: T;
}[];

export type DeclarationParserContextDebugOption = {
  verbose: boolean;
  depth: number;
};

export class DeclarationParserContext<LexToken, Variant> {
  debug: DeclarationParserContextDebugOption;

  constructor(
    public env: DeclarationParserEnv<LexToken, Variant>,
    debug?: boolean | Partial<DeclarationParserContextDebugOption>,
  ) {
    if (typeof debug === "boolean" && debug) {
      this.debug = {
        verbose: true,
        depth: 0,
      };
    } else if (typeof debug === "object") {
      this.debug = {
        verbose: true,
        depth: 0,
        ...debug,
      };
    } else {
      this.debug = {
        verbose: false,
        depth: 0,
      };
    }
  }

  increment(): DeclarationParserContext<LexToken, Variant> {
    return new DeclarationParserContext(this.env, { ...this.debug, depth: this.debug.depth + 1 })
  }

  logIt<T>(msg: string | ((x: T) => string), style?: string) {
    return this.logItIf(_ => true, msg, style)
  }

  logItIf<T>(condition: (x: T) => boolean, msg: string | ((x: T) => string), style?: string) {
    if (this.debug.verbose) {
      if (typeof msg === "string") {
        return logItIf<T>(condition, `${"  ".repeat(this.debug.depth)}${msg}`, style)
      } else {
        return logItIf<T>(condition, x => `${"  ".repeat(this.debug.depth)}${msg(x)}`, style)
      }
    } else {
      return (x: T) => x
    }
  }
}

export class DeclarationParser<LexToken extends { uid: number; contents: string }, Variant> implements Parser<LexToken, Variant> {
  private getEnv(dec: Declaration<Variant>): DeclarationParserEnv<LexToken, Variant> {
    function gather(dec: Declaration<Variant>, visited: ImmutableSet<Declaration<Variant>> = new ImmutableSet([], x => x.uid)): ImmutableSet<Declaration<Variant>> {
      if (visited.has(dec)) {
        return visited
      } else {
        const visitedNext = visited.add(dec);
        return Declaration.apply<Variant, ImmutableSet<Declaration<Variant>>>(
          dec => Arr.reduce<Declaration<Variant>, ImmutableSet<Declaration<Variant>>>(
            visitedNext,
            (visited, subDec) => gather(subDec, visited),
          )(dec.entries.map(([key, value]) => unlazy(value))),
          dec => gather(unlazy(dec.element), visitedNext),
          dec => visitedNext,
          Arr.reduce(
            visited,
            (visited, subDec) => new ImmutableSet([...visited.toArray(), ...gather(subDec, visitedNext).toArray()])
          ),
          Arr.reduce(
            visited,
            (visited, subDec) => new ImmutableSet([...visited.toArray(), ...gather(subDec, visitedNext).toArray()])
          ),
          dec => gather(unlazy(dec.subDec), visitedNext),
        )(dec)
      }
    }

    const decs = gather(dec).toArray();

    function fromObjectDec(
      ctx: DeclarationParserContext<LexToken, Variant>,
      input: FIFOArray<LexToken>,
      variant: Variant,
      entries: DeclarationObjectEntry<Variant>[],
    ): DeclarationParserInterpretResult<LexToken, AstObject<Variant>> {
      if (entries.length === 0) {
        return [{ input: input, output: { type: variant, data: {} } }]
      } else {
        const [key, subDec] = entries[0];
        const results = decAcceptor(unlazy(subDec))(ctx)(input);

        return pipe(
          results,
          Arr.map(result => {
            return pipe(
              fromObjectDec(ctx, result.input, variant, entries.slice(1)),
              Arr.map(next => ({
                input: next.input,
                output: { type: variant, data: key ? { [key]: result.output, ...next.output.data } : next.output.data },
              })),
            )
          }),
          Arr.flatten,
        )
      }
    }

    function fromArrayDec(
      ctx: DeclarationParserContext<LexToken, Variant>,
      input: FIFOArray<LexToken>,
      subDec: Declaration<Variant>,
      atLeast: Option.Option<number>,
      atMost: Option.Option<number>,
    ): DeclarationParserInterpretResult<LexToken, AstArray<Variant>> {
      const decrement = Option.map((x: number) => x - 1);
      ctx.logIt(`array: ${Option.getOrElseW(() => "none")(atLeast).toString()} ~ ${Option.getOrElseW(() => "none")(atMost).toString()}`)(undefined);

      if (Option.isSome(atMost) && atMost.value === 0) {
        return [{ input: input, output: [] }]
      } else {
        const results = decAcceptor(subDec)(ctx)(input);
        if (results.length === 0) {
          if (Option.isNone(atLeast) || atLeast.value <= 0) {
            return [{ input: input, output: [] }]
          } else {
            return []
          }
        } else {
          return pipe(
            results,
            Arr.map(result => {
              return pipe(
                fromArrayDec(ctx, result.input, subDec, decrement(atLeast), decrement(atMost)),
                Arr.map(next => ({
                  input: next.input,
                  output: [result.output, ...next.output],
                })),
              )
            }),
            Arr.flatten,
          )
        }
      }
    }

    function fromLiteralDec(
      ctx: DeclarationParserContext<LexToken, Variant>,
      input: FIFOArray<LexToken>,
      tokenUid: number,
      maybePattern?: RegExp,
      mapper?: (x: string) => AstLiteral,
    ): DeclarationParserInterpretResult<LexToken, AstLiteral> {
      if (input.length === 0) {
        return []
      } else {
        const pattern = maybePattern ? maybePattern : new RegExp(".*");
        if (input[0].uid === tokenUid && pattern.exec(input[0].contents) !== null) {
          return [{ input: input.slice(1), output: (mapper || (x => x))(input[0].contents) }]
        } else {
          return []
        }
      }
    }

    function fromUnionDec(
      ctx: DeclarationParserContext<LexToken, Variant>,
      input: FIFOArray<LexToken>,
      elements: Declaration<Variant>[],
      ordered: boolean,
    ): DeclarationParserInterpretResult<LexToken, Ast<Variant>> {
      if (ordered) {
        return pipe(
          elements,
          Arr.reduce([], (results, dec) => results.length > 0 ? results : decAcceptor(dec)(ctx)(input)),
        )
      } else {
        return pipe(
          elements,
          Arr.map(dec => decAcceptor(dec)(ctx)(input)),
          Arr.flatten,
        )
      }
    }

    function fromSequenceDec(
      ctx: DeclarationParserContext<LexToken, Variant>,
      input: FIFOArray<LexToken>,
      elements: Declaration<Variant>[],
    ): DeclarationParserInterpretResult<LexToken, AstArray<Variant>> {
      if (elements.length === 0) {
        return [{ input: input, output: [] }]
      } else {
        const results = decAcceptor(elements[0])(ctx)(input);
        return pipe(
          results,
          Arr.map(result => {
            return pipe(
              fromSequenceDec(ctx, result.input, elements.slice(1)),
              Arr.map(next => ({
                input: next.input,
                output: [result.output, ...next.output],
              })),
            )
          }),
          Arr.flatten,
        )
      }
    }

    function fromMapperDec(
      ctx: DeclarationParserContext<LexToken, Variant>,
      input: FIFOArray<LexToken>,
      subDec: Declaration<Variant>,
      mapper: (x: Ast<Variant>) => Ast<Variant>[],
    ): DeclarationParserInterpretResult<LexToken, Ast<Variant>> {
      return pipe(
        decAcceptor(subDec)(ctx)(input),
        Arr.map(result => pipe(
          mapper(result.output),
          Arr.map(output => ({ ...result, output: output })),
        )),
        Arr.flatten,
      )
    }

    function decAcceptor(dec: Declaration<Variant>) {
      return (ctx: DeclarationParserContext<LexToken, Variant>) => (input: FIFOArray<LexToken>) => {
        const applier = Declaration.apply<Variant, DeclarationParserInterpretResult<LexToken, Ast<Variant>>>(
          (dec) => fromObjectDec(ctx.increment(), input, dec.variant, dec.entries),
          (dec) => fromArrayDec(ctx.increment(), input, unlazy(dec.element), Option.fromNullable(dec.atLeast), Option.fromNullable(dec.atMost)),
          (dec) => fromLiteralDec(ctx.increment(), input, dec.token.uid, dec.token.pattern),
          (decs, ordered) => fromUnionDec(ctx.increment(), input, decs, ordered),
          (decs) => fromSequenceDec(ctx.increment(), input, decs),
          (dec) => fromMapperDec(ctx.increment(), input, unlazy(dec.subDec), dec.mapper),
        );
        ctx.logIt(`<${Declaration.debugName(dec)}>`)(undefined);
        ctx.logIt(`  [${input.map(t => `'${t.contents}'`).join(", ")}]`, "\x1b[34m")(undefined);
        const results = applier(dec);
        if (results.length === 0) {
          ctx.logIt("  => failed", "\x1b[31m")(undefined);
        } else {
          results.map(ctx.logIt(x => `  => matched ${input.slice(0, input.length - x.input.length).map(t => `'${t.contents}'`).join(", ")}`, "\x1b[32m"))
        }
        ctx.logIt(`<${Declaration.debugName(dec)}/>`)(undefined);
        return results
      }
    }

    return pipe(
      decs,
      Arr.map(
        dec => [
          dec.uid,
          decAcceptor(dec),
        ] as const,
      ),
      pairs => new ImmutableMap(pairs),
    );
  }

  ctx: DeclarationParserContext<LexToken, Variant>;

  constructor(private dec: Declaration<Variant>, debug?: ((typeof DeclarationParserContext) extends new(_: any, debug: infer X) => any ? X : never)) {
    this.ctx = new DeclarationParserContext(this.getEnv(dec), debug);
  }

  parse(input: FIFOArray<LexToken>): Either.Either<ParseError, Ast<Variant>> {
    const acceptor = this.ctx.env.getMust(this.dec.uid);
    const results = acceptor(this.ctx)(input)
      .filter(result => result.input.length === 0);

    if (results.length === 0) {
      return Either.left(new Error("parse error"))
    } else if (results.length === 1) {
      return Either.right(results[0].output);
    } else {
      if (this.ctx.debug.verbose) {
        return Either.left(new Error(`result is ambiguous:\n${results.map((result, i) => `  ${i + 1}: ${JSON.stringify(result.output)}`).join("\n")}`))
      } else {
        return Either.left(new Error("result is ambiguous"))
      }
    }
  }
}
