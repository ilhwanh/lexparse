import {buildLexer} from "./lex";
import {buildParser} from "./parse";

export const { lexer, lex } = buildLexer();
export const { parser } = buildParser(lex);
