import * as Either from "fp-ts/Either";
import * as Arr from "fp-ts/Array";
import {pipe} from "fp-ts/function";
import * as Option from "fp-ts/Option";
import {assertNever, logIt, logItIf} from "../utils";
import {ImmutableMap, ImmutableSet} from "../utils/immutable";
import {FIFOArray} from "./lexer";

type ParseError = Error;

export interface Tree<T> {
  value: T;
  children: Tree<T>[];
}

export interface Parser<Token, ParseNode> {
  parse(tokens: Token[]): Either.Either<ParseError, ParseNode>
}

export type Indicator<T> =
  {
    type: "open",
    key: string,
  } |
  {
    type: "close",
    key: string,
  } |
  {
    type: "entry",
    data: T,
  };

export type Declaration = {
  uid: string;
  entries: DeclarationEntry[];
}

export type DeclarationEntry = (Reference | TokenMatch)[];

export type Reference = {
  type: "reference";
  target(): Declaration;
};

export function reference(target: () => Declaration): Reference {
  return {
    type: "reference",
    target: target,
  }
}

export type TokenMatch = {
  type: "tokenMatch";
  uid: string;
  re?: RegExp;
}

export function tokenMatch(uid: string, re?: RegExp): TokenMatch {
  return {
    type: "tokenMatch",
    uid: uid,
    re: re,
  }
}

const inlineDecCache: { [uid: string]: Declaration } = {};

export function zeroOrMore(single: Declaration): Declaration {
  const uid = `${single.uid}*`;

  if (!(uid in inlineDecCache)) {
    inlineDecCache[uid] = {
      uid: `${single.uid}*`,
      entries: [
        [reference(() => oneOrMore(single))],
        [],
      ]
    }
  }

  return inlineDecCache[uid]
}

export function oneOrMore(single: Declaration): Declaration {
  const uid = `${single.uid}+`;

  if (!(uid in inlineDecCache)) {
    const self: Declaration = {
      uid: `${single.uid}+`,
      entries: [
        [
          reference(() => single),
          reference(() => zeroOrMore(single)),
        ],
      ]
    }

    inlineDecCache[uid] = self
  }

  return inlineDecCache[uid]
}

type DeclarationParserPlaceholder = {
  type: "placeholder";
};
type DeclarationParserReference = {
  type: "reference";
  uid: string;
};
type DeclarationParserTokenMatch<LexToken> = {
  type: "tokenMatch";
  token: LexToken;
};
type DeclarationParserNode<LexToken> = Tree<DeclarationParserPlaceholder | DeclarationParserReference | DeclarationParserTokenMatch<LexToken>>;
type DeclarationParserState<LexToken> = {
  consumed: FIFOArray<LexToken>;
  tree: DeclarationParserNode<LexToken>;
};
type DeclarationParserEnv<LexToken> = ImmutableMap<string, (ctx: DeclarationParserContext<LexToken>) => (input: LexToken[]) => DeclarationParserState<LexToken>[]>;
class DeclarationParserContext<LexToken> {
  debug: { verbose: boolean; depth: number; };

  constructor(
    public env: DeclarationParserEnv<LexToken>,
    debug?: { verbose: boolean; depth: number; },
  ) {
    if (debug) {
      this.debug = debug;
    } else {
      this.debug = {
        verbose: false,
        depth: 0,
      };
    }
  }

  increment(): DeclarationParserContext<LexToken> {
    return new DeclarationParserContext(this.env, { ...this.debug, depth: this.debug.depth + 1 })
  }

  logIt<T>(msg: string | ((x: T) => string)) {
    return this.logItIf(_ => true, msg)
  }

  logItIf<T>(condition: (x: T) => boolean, msg: string | ((x: T) => string)) {
    if (this.debug.verbose) {
      if (typeof msg === "string") {
        return logItIf<T>(condition, `${"  ".repeat(this.debug.depth)}${msg}`)
      } else {
        return logItIf<T>(condition, x => `${"  ".repeat(this.debug.depth)}${msg(x)}`)
      }
    } else {
      return (x: T) => x
    }
  }
}

export class DeclarationParser<LexToken extends { uid: string; contents: string }> implements Parser<LexToken, DeclarationParserNode<LexToken>> {
  private getEnv(dec: Declaration): DeclarationParserEnv<LexToken> {
    function gather(dec: Declaration, visited: ImmutableSet<Declaration> = new ImmutableSet()): ImmutableSet<Declaration> {
      if (visited.has(dec)) {
        return visited
      } else {
        return Arr.reduce<DeclarationEntry, ImmutableSet<Declaration>>(
          visited.add(dec),
          (visited, entry) => Arr.reduce<Reference | TokenMatch, ImmutableSet<Declaration>>(
            visited,
            (visited, elem) => {
              return elem.type === "reference" ?
                gather(elem.target(), visited) :
                visited
            }
          )(entry)
        )(dec.entries)
      }
    }

    const decs = [dec, ...gather(dec).toArray()];

    function interpretElem(ctx: DeclarationParserContext<LexToken>, input: LexToken[], elem: Reference | TokenMatch): DeclarationParserState<LexToken>[] {
      if (elem.type === "tokenMatch") {
        if (input.length === 0) {
          return []
        }

        ctx.logIt(`${elem.uid}: ${input[0].uid} '${input[0].contents}'`)(undefined);
        const pattern = new RegExp(`^(${elem.re ? elem.re.source : ".*"})$`);

        if (pattern.exec(input[0].contents) && input[0].uid === elem.uid) {
          return [
            {
              consumed: [input[0]],
              tree: {
                value: {
                  type: "tokenMatch",
                  token: input[0],
                },
                children: [],
              },
            },
          ]
        } else {
          return []
        }
      } else if (elem.type === "reference") {
        return ctx.env.getMust(elem.target().uid)(ctx.increment())(input)
      } else {
        assertNever(elem);
      }
    }

    function interpretEntry(ctx: DeclarationParserContext<LexToken>, input: LexToken[], entry: DeclarationEntry): DeclarationParserState<LexToken>[] {
      const initialState = {
        consumed: [],
        tree: {
          value: {
            type: "placeholder",
          },
          children: [],
        },
      } as DeclarationParserState<LexToken>;

      ctx.logIt(`"${entry.map(elem => elem.type === "reference" ? elem.target().uid : elem.uid).join("-")}"`)(undefined);

      return pipe(
        entry,
        Arr.reduce<Reference | TokenMatch, DeclarationParserState<LexToken>[]>(
          [initialState],
          (states, elem) => {
            return pipe(
              states,
              Arr.map(state => {
                return pipe(
                  interpretElem(ctx, input.slice(state.consumed.length), elem),
                  Arr.map(result => ({
                    consumed: [...state.consumed, ...result.consumed],
                    tree: {
                      ...state.tree,
                      children: [result.tree, ...state.tree.children],
                    }
                  } as DeclarationParserState<LexToken>))
                )
              }),
              Arr.flatten,
            )
          }
        ),
      )
    }

    function decAcceptor(dec: Declaration) {
      return (ctx: DeclarationParserContext<LexToken>) =>
        (input: LexToken[]) => pipe(
          dec.entries,
          ctx.logIt(`<${dec.uid}> where [${input.map(x => `"${x.contents}"`).join(", ")}]`),
          Arr.map(entry => interpretEntry(ctx, input, entry)),
          Arr.flatten,
          Arr.map(result => ({
            consumed: result.consumed,
            tree: {
              value: {
                type: "reference",
                uid: dec.uid,
              },
              children: result.tree.children,
            },
          } as DeclarationParserState<LexToken>)),
          ctx.logItIf(arr => arr.length === 0, `</${dec.uid}> failed to match`),
          Arr.map(ctx.logIt(result => `</${dec.uid}> matched '${result.tree.value["uid"] || ""}' => [${result.consumed.map(x => `"${x.uid}:${x.contents}"`).join(", ")}]`)),
        )
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

  ctx: DeclarationParserContext<LexToken>;

  constructor(private dec: Declaration) {
    this.ctx = new DeclarationParserContext(this.getEnv(dec));
  }

  parse(input: LexToken[]): Either.Either<ParseError, DeclarationParserNode<LexToken>> {
    const acceptor = this.ctx.env.getMust(this.dec.uid);
    const results = acceptor(this.ctx)(input)
      .filter(result => result.consumed.length === input.length);

    if (results.length === 0) {
      return Either.left(new Error("parse error"))
    } else if (results.length === 1) {
      return Either.right(results[0].tree);
    } else {
      return Either.left(new Error("result is ambiguous"))
    }
  }

  toFifo(tree: DeclarationParserNode<LexToken>): DeclarationParserNode<LexToken> {
    function toArrayTail(tree: DeclarationParserNode<LexToken>): DeclarationParserNode<LexToken>[] {
      if (tree.value.type === "reference") {
        const flattenChildren = pipe(
          tree.children,
          Arr.map(toArrayTail),
          Arr.flatten,
        );

        if (/[*+]$/.exec(tree.value.uid) !== null) {
          return flattenChildren
        } else {
          return [{
            ...tree,
            children: flattenChildren,
          }]
        }
      } else {
        return [tree]
      }
    }

    function toFifoTail<T>(tree: Tree<T>): Tree<T> {
      return {
        value: tree.value,
        children: Arr.reverse(Arr.map(toFifoTail)(tree.children)),
      }
    }

    return toFifoTail(toArrayTail(tree)[0]);
  }
}
