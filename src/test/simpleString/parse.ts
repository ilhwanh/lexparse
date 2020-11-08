import {
  DeclarationParser, literalDec, pick, sequence, slice, union,
  zeroOrMore
} from "../..";
import {buildLexer} from "./lex";
import {once1} from "../../utils";

export const buildParser = once1("simpleString/buildParser", (lex: ReturnType<typeof buildLexer>["lex"]) => {
  type LexToken = { uid: number; contents: string; };
  type AstVariant = "simpleString" | "literal";

  const simpleString = zeroOrMore<AstVariant>(
    union(
      literalDec(lex.literal),
      pick(1, sequence(
        literalDec(lex.stringOpen),
        literalDec(lex.stringContents),
        literalDec(lex.stringClose),
      )),
    )
  );

  return {
    parser: new DeclarationParser(simpleString, true),
  }
});
