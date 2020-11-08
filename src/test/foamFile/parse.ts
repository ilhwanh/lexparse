import {buildLexer} from "./lex";
import {once1} from "../../utils";
import {
  DeclarationParser,
  literalDec,
  mapped,
  objectDec,
  oneOrMore, either,
  pick,
  sequence,
  slice,
  union,
  zeroOrMore
} from "../..";

export const buildParser = once1("foamFile/buildParse", (lex: ReturnType<typeof buildLexer>["lex"]) => {
  type AstVariant = "foamFile" | "declaration" | "dictionary" | "dimension" | "vector" | "uniform" | "identifier" | "field" | "literal";

  const foamFile = zeroOrMore<AstVariant>(() => declaration);

  const declaration = objectDec<AstVariant>(
    "declaration",
    ["name", () => identifier],
    ["value", union(
      () => dictionary,
      pick(0,
        sequence(
          union(
            () => dimension,
            () => vector,
            () => uniform,
          ),
          literalDec(lex.semicolon),
        ),
      ),
      slice(
        0, -1,
        sequence(
          oneOrMore(() => dataLiteral),
          literalDec(lex.semicolon),
        ),
      )
    )],
  );

  const identifier = objectDec<AstVariant>(
    "identifier",
    ["name", () => literalDec<AstVariant>(lex.literal, /^[_a-zA-Z][_a-zA-Z0-9]*$/)],
  );

  const dictionary = objectDec<AstVariant>(
    "dictionary",
    ["fields", slice(
      1, -1,
      sequence(
        literalDec(lex.parenthesis, /^{$/),
        zeroOrMore(() => declaration),
        literalDec(lex.parenthesis, /^}$/),
      ),
    )],
  );

  const dimension = objectDec<AstVariant>(
    "dimension",
    ["dimension", slice(
      1, -1,
      sequence(
        literalDec(lex.parenthesis, /^\[$/),
        oneOrMore(() => dataLiteral),
        literalDec(lex.parenthesis, /^]$/),
      ),
    )]
  )

  const vector = objectDec<AstVariant>(
    "vector",
    ["values", slice(
      1, -1,
      sequence(
        literalDec(lex.parenthesis, /^\($/),
        zeroOrMore(() => dataLiteral),
        literalDec(lex.parenthesis, /^\)$/),
      ),
    )]
  );

  const uniform = objectDec<AstVariant> (
    "uniform",
    [undefined, literalDec(lex.literal, /^uniform$/)],
    ["values", () => vector],
  );

  const stringOrNumber = (contents: string) => /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$/.exec(contents) ? [Number.parseFloat(contents)] : [contents];

  const dataLiteral = union<AstVariant>(
    mapped(stringOrNumber, literalDec(lex.literal)),
  );

  return {
    parser: new DeclarationParser(foamFile, true),
  }
});
