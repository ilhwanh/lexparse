import {RegExpTokenizer, regExpTokenizerRule} from "../..";
import {once0} from "../../utils";

export const buildLexer = once0("simpleString/buildLexer", () => {
  type LexerState = "none" | "string";

  const whitespace = regExpTokenizerRule<LexerState>({
    pattern: /\s+/,
    oldStates: ["none"],
  });

  const stringOpen = regExpTokenizerRule<LexerState>({
    pattern: /"/,
    oldStates: ["none"],
    stateAction: {
      type: "push",
      state: "string",
    },
  });

  const stringClose = regExpTokenizerRule<LexerState>({
    pattern: /"/,
    oldStates: ["string"],
    stateAction: {
      type: "pop",
    },
  });

  const stringContents = regExpTokenizerRule<LexerState>({
    pattern: /.*/,
    oldStates: ["string"],
  });

  const literal = regExpTokenizerRule<LexerState>({
    pattern: /.+/,
    oldStates: ["none"],
  });

  return {
    lexer: new RegExpTokenizer([whitespace, stringOpen, stringClose, stringContents, literal], "none"),
    lex: {
      whitespace, stringOpen, stringClose, stringContents, literal,
    },
  } as const
});
