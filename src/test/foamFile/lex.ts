import {RegExpTokenizer, regExpTokenizerRule} from "../..";
import {once0} from "../../utils";

export const buildLexer = once0("foamFile/buildLexer", () => {
  type LexerState = "none" | "commentSingle" | "commentMulti" | "string";

  const whitespace = regExpTokenizerRule<LexerState>({
    pattern: /\s+/,
    oldStates: ["none"],
  });

  const commentSingleOpen = regExpTokenizerRule<LexerState>({
    pattern: /\/\//,
    oldStates: ["none"],
    stateAction: {
      type: "push",
      state: "commentSingle",
    },
  });

  const commentSingleClose = regExpTokenizerRule<LexerState>({
    pattern: /\n/,
    oldStates: ["commentSingle"],
    stateAction: {
      type: "pop",
    },
  });

  const commentMultiOpen = regExpTokenizerRule<LexerState>({
    pattern: /\/\*/,
    oldStates: ["none"],
    stateAction: {
      type: "push",
      state: "commentMulti",
    },
  });

  const commentMultiClose = regExpTokenizerRule<LexerState>({
    pattern: /\*\//,
    oldStates: ["commentMulti"],
    stateAction: {
      type: "pop",
    },
  });

  const commentContents = regExpTokenizerRule<LexerState>({
    pattern: /(.|\n)*/,
    oldStates: ["commentSingle", "commentMulti"],
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

  const parenthesis = regExpTokenizerRule<LexerState>({
    pattern: /[{}[\]()<>]/,
  });

  const semicolon = regExpTokenizerRule<LexerState>({
    pattern: /;/,
  });

  const literal = regExpTokenizerRule<LexerState>({
    pattern: /.+/,
    oldStates: ["none"],
  });

  const lexer = new RegExpTokenizer<LexerState>([
    whitespace,
    commentSingleOpen,
    commentSingleClose,
    commentMultiOpen,
    commentMultiClose,
    commentContents,
    stringOpen,
    stringClose,
    stringContents,
    parenthesis,
    semicolon,
    literal,
  ], "none");

  return {
    lex: {
      whitespace,
      commentSingleOpen,
      commentSingleClose,
      commentMultiOpen,
      commentMultiClose,
      commentContents,
      stringOpen,
      stringClose,
      stringContents,
      parenthesis,
      semicolon,
      literal,
    },
    lexer: lexer,
  }
});
