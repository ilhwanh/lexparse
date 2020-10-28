import * as Either from "fp-ts/Either";
import {assertNever} from "../utils";
import {StateAction} from "./pushdown";
import * as Arr from "fp-ts/Array";
import {pipe} from "fp-ts/function";
import {ImmutableMap} from "../utils/immutable";

type TokenizerError = Error;

export interface BinToken {
  length: number;
  contents: string;
}

export interface Token extends BinToken {
  from: number;
  to: number;
}

export type Tokenizer<T extends Token> = {
  tokenize(raw: string): Either.Either<TokenizerError, T[]>;
};

export type RuleTokenizerRule<Fold, State, T> = (fold: Fold, state: State, text: string) => Either.Either<Fold, { newState: StateAction<State>, binToken: T }>;

export class RuleTokenizer<T extends BinToken, Fold, State = string, U extends (T & Token) = (T & Token)> implements Tokenizer<U> {
  constructor(protected rules: FIFOArray<RuleTokenizerRule<Fold, State, T>>, protected initialState: State, protected emptyFold: Fold) {}

  tokenize(rawWhole: string): Either.Either<TokenizerError, U[]> {
    const emptyFold = this.emptyFold;

    function textPointer(text: string, index: number) {
      return ` ${rawWhole.replace(/\s/g, " ")}\n ${" ".repeat(index)}^`
    }

    function tokenizeTail(fold: Fold, stateStack: State[], raw: string, index: number, rules: RuleTokenizerRule<Fold, State, T>[], ruleWhole: RuleTokenizerRule<Fold, State, T>[]): Either.Either<TokenizerError, U[]> {
      if (raw.length === 0) {
        return Either.right([])
      }

      if (rules.length === 0) {
        return Either.left(new Error(`syntax error at ${index} stuck at state ${JSON.stringify(stateStack)}\n${textPointer(rawWhole, index)}`))
      }

      const match = rules[0](fold, stateStack[0], raw);

      if (Either.isRight(match)) {
        const { newState, binToken } = match.right;
        const token = {
          ...binToken,
          from: index,
          to: index + binToken.length,
        } as U;
        const stateAction = newState;
        if (!raw.startsWith(token.contents)) {
          return Either.left(new Error("a rule must match from the start"))
        }

        const newStateStack =
          stateAction.type === "push" ? [stateAction.state, ...stateStack] :
          stateAction.type === "pop" ? stateStack.slice(1) :
          stateAction.type === "idle" ? stateStack :
          assertNever(stateAction);

        if (newStateStack.length === 0) {
          return Either.left(new Error(`syntax error at ${index} run out of stack\n${textPointer(rawWhole, index)}`))
        }

        const tokensTail = tokenizeTail(emptyFold, newStateStack, raw.slice(token.length), index + token.length, ruleWhole, ruleWhole);
        return Either.chain<Error, U[], U[]>((tokens: U[]) => Either.right([token, ...tokens]))(tokensTail)
      } else {
        const newFold = match.left;
        return tokenizeTail(newFold, stateStack, raw, index, rules.slice(1), ruleWhole)
      }
    }

    return tokenizeTail(emptyFold, [this.initialState], rawWhole, 0, this.rules, this.rules)
  }
}

export interface FIFOArray<T> extends Array<T> {}

export interface RegExpTokenizerRule<State> {
  uid: string;
  oldStates?: State[];
  stateAction?: StateAction<State>;
  pattern: RegExp | string;
  ignore?: string[];
}

export interface RegExpTokenizerFold {
  cache: ImmutableMap<string, number>;
}

export type RegExpTokenizerToken = BinToken & { uid: string }

export class RegExpTokenizer<State> extends RuleTokenizer<BinToken, RegExpTokenizerFold, State> {
  constructor(public regexpRules: FIFOArray<RegExpTokenizerRule<State>>, protected initialState: State, protected groupName: string = "contents") {
    super(regexpRules
      .map(
        regexpRule => ({
          ...regexpRule,
          patternCompiled: regexpRule.pattern instanceof RegExp ? regexpRule.pattern : new RegExp(regexpRule.pattern, "m"),
        })
      )
      .flatMap(
      regexpRule => (regexpRule.oldStates || [undefined]).flatMap(
        oldState => (fold: RegExpTokenizerFold, state: State, text: string) => {
          if (oldState !== undefined && state !== oldState) {
            return Either.left(fold)
          }

          const breakAt =
            Arr.reduce<[string, number], number | null>(
              null,
              (breakAt, [name, index]) => (name in (regexpRule.ignore || [])) ? breakAt : breakAt === null ? index : Math.min(index, breakAt)
            )(fold.cache.entries());

          const match = regexpRule.patternCompiled.exec(breakAt === null ? text : text.slice(0, breakAt));
          const contents = match !== null ? match[groupName] || match[0] : null;

          if (contents !== null && text.startsWith(contents)) {
            return Either.right({
              newState: (regexpRule.stateAction || { type: "idle" }),
              binToken: {
                uid: regexpRule.uid,
                length: contents.length,
                contents: contents,
              },
            })
          } else if (contents !== null) {
            return Either.left({
              cache: fold.cache.add(regexpRule.uid, text.search(regexpRule.patternCompiled)),
            });
          } else {
            return Either.left(fold);
          }
        }
      )
    ), initialState, { cache: new ImmutableMap() });
  }
}
