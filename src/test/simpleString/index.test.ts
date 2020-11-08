import * as simpleString from ".";
import * as Either from "fp-ts/Either";
import {expect} from "chai";

describe("simpleString", () => {
  const dataset = [
    {
      name: "simple",
      input: `a "b c" d`,
      tokens: ["a", "\"", "b c", "\"", "d"],
      ast: ["a", "b c", "d"],
    }
  ];

  dataset.forEach(data => {
    it(data.name, () => {
      const tokens = simpleString.lexer.tokenize(data.input);
      if (Either.isLeft(tokens)) {
        expect.fail(tokens.left.message)
      }
      const tokenClean = tokens.right.filter(token => token.uid !== simpleString.lex.whitespace.uid);
      expect(tokenClean.map(token => token.contents)).to.deep.equal(data.tokens);

      const ast = simpleString.parser.parse(tokenClean);
      if (Either.isLeft(ast)) {
        expect.fail(ast.left.message)
      }
      expect(ast.right).to.deep.equal(data.ast);
    });
  })
})
