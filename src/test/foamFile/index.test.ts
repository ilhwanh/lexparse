import * as grammar from ".";
import * as Either from "fp-ts/Either";
import {expect} from "chai";

describe("foamFile", () => {
  const whitespaces = new Set([
    grammar.lex.whitespace.uid,
    grammar.lex.commentSingleOpen.uid,
    grammar.lex.commentSingleClose.uid,
    grammar.lex.commentMultiOpen.uid,
    grammar.lex.commentMultiClose.uid,
    grammar.lex.commentContents.uid,
  ]);

  const dataset = [
    {
      name: "simple",
      input: `a { b 1; }`,
      tokens: ["a", "{", "b", "1", ";", "}"],
      ast: [
        {
          "type": "declaration",
          "data": {
            "name": {
              "type": "identifier",
              "data": {
                "name": "a"
              }
            },
            "value": {
              "type": "dictionary",
              "data": {
                "fields": [
                  {
                    "type": "declaration",
                    "data": {
                      "name": {
                        "type": "identifier",
                        "data": {
                          "name": "b"
                        }
                      },
                      "value": [
                        1
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      ],
    },
    {
      name: "twoDict",
      input: `a { b 1; }\nc { d 2; e 3; }`,
      tokens: ["a", "{", "b", "1", ";", "}", "c", "{", "d", "2", ";", "e", "3", ";", "}"],
      ast: [
        {
          "type": "declaration",
          "data": {
            "name": {
              "type": "identifier",
              "data": {
                "name": "a"
              }
            },
            "value": {
              "type": "dictionary",
              "data": {
                "fields": [
                  {
                    "type": "declaration",
                    "data": {
                      "name": {
                        "type": "identifier",
                        "data": {
                          "name": "b"
                        }
                      },
                      "value": [
                        1
                      ]
                    }
                  }
                ]
              }
            }
          }
        },
        {
          "type": "declaration",
          "data": {
            "name": {
              "type": "identifier",
              "data": {
                "name": "c"
              }
            },
            "value": {
              "type": "dictionary",
              "data": {
                "fields": [
                  {
                    "type": "declaration",
                    "data": {
                      "name": {
                        "type": "identifier",
                        "data": {
                          "name": "d"
                        }
                      },
                      "value": [
                        2
                      ]
                    }
                  },
                  {
                    "type": "declaration",
                    "data": {
                      "name": {
                        "type": "identifier",
                        "data": {
                          "name": "e"
                        }
                      },
                      "value": [
                        3
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      ],
    },
    {
      name: "U",
      input: `/*--------------------------------*- C++ -*----------------------------------*\\
| =========                 |                                                 |
| \\\\      /  F ield         | OpenFOAM: The Open Source CFD Toolbox           |
|  \\\\    /   O peration     | Version:  4.0                                   |
|   \\\\  /    A nd           | Web:      www.OpenFOAM.org                      |
|    \\\\/     M anipulation  |                                                 |
\\*---------------------------------------------------------------------------*/
FoamFile
{
    version     2.0;
    format      ascii;
    class       volVectorField;
    object      U;
}
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

dimensions      [0 1 -1 0 0 0 0];

internalField   uniform (0 0 0);

boundaryField
{
    floor
    {
        type            noSlip;
    }

    ceiling
    {
        type            noSlip;
    }

    fixedWalls
    {
        type            noSlip;
    }

    box
    {
        type            noSlip;
    }
}

// ************************************************************************* //`,
      tokens: [
        "FoamFile",
        "{",
        "version",
        "2.0",
        ";",
        "format",
        "ascii",
        ";",
        "class",
        "volVectorField",
        ";",
        "object",
        "U",
        ";",
        "}",
        "dimensions",
        "[",
        "0",
        "1",
        "-1",
        "0",
        "0",
        "0",
        "0",
        "]",
        ";",
        "internalField",
        "uniform",
        "(",
        "0",
        "0",
        "0",
        ")",
        ";",
        "boundaryField",
        "{",
        "floor",
        "{",
        "type",
        "noSlip",
        ";",
        "}",
        "ceiling",
        "{",
        "type",
        "noSlip",
        ";",
        "}",
        "fixedWalls",
        "{",
        "type",
        "noSlip",
        ";",
        "}",
        "box",
        "{",
        "type",
        "noSlip",
        ";",
        "}",
        "}",
      ],
      ast: [
        {
          "type": "declaration",
          "data": {
            "name": {
              "type": "identifier",
              "data": {
                "name": "FoamFile"
              }
            },
            "value": {
              "type": "dictionary",
              "data": {
                "fields": [
                  {
                    "type": "declaration",
                    "data": {
                      "name": {
                        "type": "identifier",
                        "data": {
                          "name": "version"
                        }
                      },
                      "value": [
                        2
                      ]
                    }
                  },
                  {
                    "type": "declaration",
                    "data": {
                      "name": {
                        "type": "identifier",
                        "data": {
                          "name": "format"
                        }
                      },
                      "value": [
                        "ascii"
                      ]
                    }
                  },
                  {
                    "type": "declaration",
                    "data": {
                      "name": {
                        "type": "identifier",
                        "data": {
                          "name": "class"
                        }
                      },
                      "value": [
                        "volVectorField"
                      ]
                    }
                  },
                  {
                    "type": "declaration",
                    "data": {
                      "name": {
                        "type": "identifier",
                        "data": {
                          "name": "object"
                        }
                      },
                      "value": [
                        "U"
                      ]
                    }
                  }
                ]
              }
            }
          }
        },
        {
          "type": "declaration",
          "data": {
            "name": {
              "type": "identifier",
              "data": {
                "name": "dimensions"
              }
            },
            "value": {
              "type": "dimension",
              "data": {
                "dimension": [
                  0,
                  1,
                  -1,
                  0,
                  0,
                  0,
                  0
                ]
              }
            }
          }
        },
        {
          "type": "declaration",
          "data": {
            "name": {
              "type": "identifier",
              "data": {
                "name": "internalField"
              }
            },
            "value": {
              "type": "uniform",
              "data": {
                "values": {
                  "type": "vector",
                  "data": {
                    "values": [
                      0,
                      0,
                      0
                    ]
                  }
                }
              }
            }
          }
        },
        {
          "type": "declaration",
          "data": {
            "name": {
              "type": "identifier",
              "data": {
                "name": "boundaryField"
              }
            },
            "value": {
              "type": "dictionary",
              "data": {
                "fields": [
                  {
                    "type": "declaration",
                    "data": {
                      "name": {
                        "type": "identifier",
                        "data": {
                          "name": "floor"
                        }
                      },
                      "value": {
                        "type": "dictionary",
                        "data": {
                          "fields": [
                            {
                              "type": "declaration",
                              "data": {
                                "name": {
                                  "type": "identifier",
                                  "data": {
                                    "name": "type"
                                  }
                                },
                                "value": [
                                  "noSlip"
                                ]
                              }
                            }
                          ]
                        }
                      }
                    }
                  },
                  {
                    "type": "declaration",
                    "data": {
                      "name": {
                        "type": "identifier",
                        "data": {
                          "name": "ceiling"
                        }
                      },
                      "value": {
                        "type": "dictionary",
                        "data": {
                          "fields": [
                            {
                              "type": "declaration",
                              "data": {
                                "name": {
                                  "type": "identifier",
                                  "data": {
                                    "name": "type"
                                  }
                                },
                                "value": [
                                  "noSlip"
                                ]
                              }
                            }
                          ]
                        }
                      }
                    }
                  },
                  {
                    "type": "declaration",
                    "data": {
                      "name": {
                        "type": "identifier",
                        "data": {
                          "name": "fixedWalls"
                        }
                      },
                      "value": {
                        "type": "dictionary",
                        "data": {
                          "fields": [
                            {
                              "type": "declaration",
                              "data": {
                                "name": {
                                  "type": "identifier",
                                  "data": {
                                    "name": "type"
                                  }
                                },
                                "value": [
                                  "noSlip"
                                ]
                              }
                            }
                          ]
                        }
                      }
                    }
                  },
                  {
                    "type": "declaration",
                    "data": {
                      "name": {
                        "type": "identifier",
                        "data": {
                          "name": "box"
                        }
                      },
                      "value": {
                        "type": "dictionary",
                        "data": {
                          "fields": [
                            {
                              "type": "declaration",
                              "data": {
                                "name": {
                                  "type": "identifier",
                                  "data": {
                                    "name": "type"
                                  }
                                },
                                "value": [
                                  "noSlip"
                                ]
                              }
                            }
                          ]
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      ],
    }
  ];

  dataset.forEach(data => {
    it(data.name, () => {
      const tokens = grammar.lexer.tokenize(data.input);
      if (Either.isLeft(tokens)) {
        expect.fail(tokens.left.message)
      }
      const tokenClean = tokens.right.filter(token => !whitespaces.has(token.uid));
      // console.log(JSON.stringify(tokenClean.map(token => token.contents), undefined, "  "));
      expect(tokenClean.map(token => token.contents)).to.deep.equal(data.tokens);

      const ast = grammar.parser.parse(tokenClean);
      if (Either.isLeft(ast)) {
        expect.fail(ast.left.message)
      }
      console.log(JSON.stringify(ast.right, undefined, "  "));
      expect(ast.right).to.deep.equal(data.ast);
    });
  })
})
