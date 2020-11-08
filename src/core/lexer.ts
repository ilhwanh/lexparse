import * as Either from "fp-ts/Either";
import {assertNever, tail} from "../utils";
import {StateAction} from "./pushdown";
import * as Arr from "fp-ts/Array";
import {ImmutableMap} from "../utils/immutable";

type TokenizerError = Error;

export interface BinToken {
  uid: number;
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

    type TokenizerTailState = {
      fold: Fold;
      stateStack: State[];
      raw: string;
      index: number;
      rules: RuleTokenizerRule<Fold, State, T>[];
      ruleWhole: RuleTokenizerRule<Fold, State, T>[];
      chained: FIFOArray<U>;
    };

    function tokenizeTail({ fold, stateStack, raw, index, rules, ruleWhole, chained }: TokenizerTailState): Either.Either<Either.Either<TokenizerError, U[]>, TokenizerTailState> {
      if (raw.length === 0) {
        return Either.left(Either.right(chained))
      }

      if (rules.length === 0) {
        return Either.left(Either.left(new Error(`syntax error at ${index} stuck at state ${JSON.stringify(stateStack)}\n${textPointer(rawWhole, index)}`)))
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
          return Either.left(Either.left(new Error("a rule must match from the start")))
        }

        const newStateStack =
          stateAction.type === "push" ? [stateAction.state, ...stateStack] :
          stateAction.type === "pop" ? stateStack.slice(1) :
          stateAction.type === "idle" ? stateStack :
          assertNever(stateAction);

        if (newStateStack.length === 0) {
          return Either.left(Either.left(new Error(`syntax error at ${index} run out of stack\n${textPointer(rawWhole, index)}`)))
        }

        return Either.right({
          fold: emptyFold,
          stateStack: newStateStack,
          raw: raw.slice(token.length),
          index: index + token.length,
          rules: ruleWhole,
          ruleWhole: ruleWhole,
          chained: [...chained, token],
        })
      } else {
        const newFold = match.left;
        return tokenizeTail({
          fold: newFold,
          stateStack: stateStack,
          raw: raw,
          index: index,
          rules: rules.slice(1),
          ruleWhole: ruleWhole,
          chained: chained,
        })
      }
    }

    return tail({
      fold: emptyFold,
      stateStack: [this.initialState],
      raw: rawWhole,
      index: 0,
      rules: this.rules,
      ruleWhole: this.rules,
      chained: [],
    }, tokenizeTail)
  }
}

export interface FIFOArray<T> extends Array<T> {}

let regExpTokenizerRuleUid = 0;

export interface RegExpTokenizerRule<State> {
  uid: number;
  oldStates?: State[];
  stateAction?: StateAction<State>;
  pattern: RegExp | string;
  ignore?: string[];
}

export function regExpTokenizerRule<State>(contents: Omit<RegExpTokenizerRule<State>, "uid">): RegExpTokenizerRule<State> {
  return {
    ...contents,
    uid: regExpTokenizerRuleUid++,
  }
}

export interface RegExpTokenizerFold {
  cache: ImmutableMap<number, number>;
}

export type RegExpTokenizerToken = BinToken & { uid: number }

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
            Arr.reduce<[number, number], number | null>(
              null,
              (breakAt, [name, index]) => (name in (regexpRule.ignore || [])) ? breakAt : breakAt === null ? index : Math.min(index, breakAt)
            )(fold.cache.entries() as [number, number][]);

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
