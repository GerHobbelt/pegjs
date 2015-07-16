/* global describe, expect, it, beforeEach */

"use strict";

var PEG = require("../../../../lib/peg.js");

describe("compiler pass |generateBytecode|", function() {
  var pass = PEG.compiler.passes.generate.generateBytecode;

  beforeEach(function() {
    this.addMatchers(require("./helpers.js"));
  });

  function bytecodeDetails(bytecode) {
    return {
      rules: [{ bytecode: bytecode }]
    };
  }

  function constsDetails(consts, actions) {
    return actions !== undefined
      ? { consts: consts, actions: [actions] }
      : { consts: consts };
  }

  describe("for grammar", function() {
    it("generates correct bytecode", function() {
      expect(pass).toChangeAST([
        'a = "a"',
        'b = "b"',
        'c = "c"'
      ].join("\n"), {
        rules: [
          { bytecode: [16, 0, 2, 2, 20, 0, 21, 1] },
          { bytecode: [16, 2, 2, 2, 20, 2, 21, 3] },
          { bytecode: [16, 4, 2, 2, 20, 4, 21, 5] }
        ]
      });
    });

    it("defines correct constants", function() {
      expect(pass).toChangeAST([
        'a = "a"',
        'b = "b"',
        'c = "c"'
      ].join("\n"), constsDetails([
        '"a"',
        '{ type: "literal", value: "a", description: "\\"a\\"" }',
        '"b"',
        '{ type: "literal", value: "b", description: "\\"b\\"" }',
        '"c"',
        '{ type: "literal", value: "c", description: "\\"c\\"" }'
      ]));
    });
  });

  describe("for rule", function() {
    it("generates correct bytecode", function() {
      expect(pass).toChangeAST('start = "a"', bytecodeDetails([
        16, 0, 2, 2, 20, 0, 21, 1   // <expression>
      ]));
    });
  });

  describe("for named", function() {
    var grammar = 'start "start" = "a"';

    it("generates correct bytecode", function() {
      expect(pass).toChangeAST(grammar, bytecodeDetails([
        32,                          // SILENT_FAILS_ON
        14, 1, 2, 2, 18, 1, 19, 2,   // <expression>
        33,                          // SILENT_FAILS_OFF
        10, 1, 0,                    // IF_ERROR
        34,                          // SILENT_FAILS_RESET
        10, 2, 0,                    // IF_ERROR
        19, 0                        //   * FAIL
      ]));
    });

    it("defines correct constants", function() {
      expect(pass).toChangeAST(grammar, constsDetails([
        '{ type: "other", description: "start" }',
        '"a"',
        '{ type: "literal", value: "a", description: "\\"a\\"" }'
      ]));
    });
  });

  describe("for choice", function() {
    it("generates correct bytecode", function() {
      expect(pass).toChangeAST('start = "a" / "b" / "c"', bytecodeDetails([
        16, 0, 2, 2, 20, 0, 21, 1,   // <alternatives[0]>
        10, 21, 0,                   // IF_ERROR
        2,                           //   * POP
        16, 2, 2, 2, 20, 2, 21, 3,   //     <alternatives[1]>
        10, 9, 0,                    //     IF_ERROR
        2,                           //       * POP
        16, 4, 2, 2, 20, 4, 21, 5    //         <alternatives[2]>
      ]));
    });
  });

  describe("for action", function() {
    describe("without labels", function() {
      var grammar = 'start = "a" { code }';

      it("generates correct bytecode", function() {
        expect(pass).toChangeAST(grammar, bytecodeDetails([
          1,                           // PUSH_CURR_POS
          16, 0, 2, 2, 20, 0, 21, 1,   // <expression>
          11, 6, 0,                    // IF_NOT_ERROR
          22, 1,                       //   * LOAD_SAVED_POS
          24, 0, 1, 0,                 //     CALL
          5                            // NIP
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).toChangeAST(grammar, constsDetails([
          '"a"',
          '{ type: "literal", value: "a", description: "\\"a\\"" }'
        ], [
          [], ' code '
        ]));
      });
    });

    describe("with one label", function() {
      var grammar = 'start = a:"a" { code }';

      it("generates correct bytecode", function() {
        expect(pass).toChangeAST(grammar, bytecodeDetails([
          1,                           // PUSH_CURR_POS
          16, 0, 2, 2, 20, 0, 21, 1,   // <expression>
          11, 7, 0,                    // IF_NOT_ERROR
          22, 1,                       //   * LOAD_SAVED_POS
          24, 0, 1, 1, 0,              //     CALL
          5                            // NIP
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).toChangeAST(grammar, constsDetails([
          '"a"',
          '{ type: "literal", value: "a", description: "\\"a\\"" }'
        ], [
          ['a'], ' code '
        ]));
      });
    });

    describe("with multiple labels", function() {
      var grammar = 'start = a:"a" b:"b" c:"c" { code }';

      it("generates correct bytecode", function() {
        expect(pass).toChangeAST(grammar, bytecodeDetails([
          1,                           // PUSH_CURR_POS
          16, 0, 2, 2, 18, 0, 19, 1,   // <elements[0]>
          11, 40, 3,                   // IF_NOT_ERROR
          16, 2, 2, 2, 18, 2, 19, 3,   //   * <elements[1]>
          11, 25, 4,                   //     IF_NOT_ERROR
          16, 4, 2, 2, 18, 4, 19, 5,   //       * <elements[2]>
          11, 10, 4,                   //         IF_NOT_ERROR
          22, 3,                       //           * LOAD_SAVED_POS
          24, 0, 3, 3, 2, 1, 0,        //             CALL
          5,                           //             NIP
          4, 3,                        //           * POP_N
          3,                           //             POP_CURR_POS
          28,                          //             PUSH_FAILED
          4, 2,                        //       * POP_N
          3,                           //         POP_CURR_POS
          28,                          //         PUSH_FAILED
          2,                           //   * POP
          3,                           //     POP_CURR_POS
          28                           //     PUSH_FAILED
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).toChangeAST(grammar, constsDetails([
          '"a"',
          '{ type: "literal", value: "a", description: "\\"a\\"" }',
          '"b"',
          '{ type: "literal", value: "b", description: "\\"b\\"" }',
          '"c"',
          '{ type: "literal", value: "c", description: "\\"c\\"" }'
        ], [
          ['a', 'b', 'c'], ' code '
        ]));
      });
    });
  });

  describe("for sequence", function() {
    describe("empty", function() {
      var grammar = 'start = ';

      it("does fail the parse with an error", function() {
        expect(function () {
          try {
          var parser = PEG.buildParser(grammar);
        } catch (e) {
          console.log("201: ", e, e.stack);
          throw e;
        }
        }).toThrow('Expected "!", "$", "&", "(", ".", character class, comment, end of line, identifier, literal or whitespace but end of input found.');
      });

      xit("generates correct bytecode", function() {
        expect(pass).toChangeAST(grammar, bytecodeDetails([
          0, 0   // PUSH
        ]));
      });

      xit("defines correct constants", function() {
        expect(pass).toChangeAST(grammar, constsDetails(['[]']));
      });
    });

    describe("non-empty", function() {
      var grammar = 'start = "a" "b" "c"';

      it("generates correct bytecode", function() {
        expect(pass).toChangeAST(grammar, bytecodeDetails([
          1,                           // PUSH_CURR_POS
          16, 0, 2, 2, 18, 0, 19, 1,   // <elements[0]>
          11, 33, 3,                   // IF_NOT_ERROR
          16, 2, 2, 2, 18, 2, 19, 3,   //   * <elements[1]>
          11, 18, 4,                   //     IF_NOT_ERROR
          16, 4, 2, 2, 18, 4, 19, 5,   //       * <elements[2]>
          11, 3, 4,                    //         IF_NOT_ERROR
          7, 3,                        //           * WRAP
          5,                           //             NIP
          4, 3,                        //           * POP_N
          3,                           //             POP_CURR_POS
          28,                          //             PUSH_FAILED
          4, 2,                        //       * POP_N
          3,                           //         POP_CURR_POS
          28,                          //         PUSH_FAILED
          2,                           //   * POP
          3,                           //     POP_CURR_POS
          28                           //     PUSH_FAILED
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).toChangeAST(grammar, constsDetails([
          '"a"',
          '{ type: "literal", value: "a", description: "\\"a\\"" }',
          '"b"',
          '{ type: "literal", value: "b", description: "\\"b\\"" }',
          '"c"',
          '{ type: "literal", value: "c", description: "\\"c\\"" }'
        ]));
      });
    });
  });

  describe("for labeled", function() {
    it("generates correct bytecode", function() {
      expect(pass).toChangeAST('start = a:"a"', bytecodeDetails([
        16, 0, 2, 2, 20, 0, 21, 1   // <expression>
      ]));
    });
  });

  describe("for text", function() {
    it("generates correct bytecode", function() {
      expect(pass).toChangeAST('start = $"a"', bytecodeDetails([
        1,                           // PUSH_CURR_POS
        16, 0, 2, 2, 20, 0, 21, 1,   // <expression>
        11, 2, 1,                    // IF_NOT_ERROR
        2,                           //   * POP
        8,                           //     TEXT
        5                            //   * NIP
      ]));
    });
  });

  describe("for simple_and", function() {
    var grammar = 'start = &"a"';

    it("generates correct bytecode", function() {
      expect(pass).toChangeAST(grammar, bytecodeDetails([
        1,                           // PUSH_CURR_POS
        26,                          // SILENT_FAILS_ON
        16, 0, 2, 2, 18, 0, 19, 1,   // <expression>
        27,                          // SILENT_FAILS_OFF
        11, 3, 3,                    // IF_NOT_ERROR
        2,                           //   * POP
        3,                           //     POP_CURR_POS
        26,                          //     PUSH_UNDEFINED
        2,                           //   * POP
        2,                           //     POP
        28                           //     PUSH_FAILED
      ]));
    });

    it("defines correct constants", function() {
      expect(pass).toChangeAST(grammar, constsDetails([
        '"a"',
        '{ type: "literal", value: "a", description: "\\"a\\"" }'
      ]));
    });
  });

  describe("for simple_not", function() {
    var grammar = 'start = !"a"';

    it("generates correct bytecode", function() {
      expect(pass).toChangeAST(grammar, bytecodeDetails([
        1,                           // PUSH_CURR_POS
        26,                          // SILENT_FAILS_ON
        16, 0, 2, 2, 18, 0, 19, 1,   // <expression>
        27,                          // SILENT_FAILS_OFF
        10, 3, 3,                    // IF_ERROR
        2,                           //   * POP
        2,                           //     POP
        26,                          //     PUSH_UNDEFINED
        2,                           //   * POP
        3,                           //     POP_CURR_POS
        28                           //     PUSH_FAILED
      ]));
    });

    it("defines correct constants", function() {
      expect(pass).toChangeAST(grammar, constsDetails([
        '"a"',
        '{ type: "literal", value: "a", description: "\\"a\\"" }'
      ]));
    });
  });

  describe("for optional", function() {
    var grammar = 'start = "a"?';

    it("generates correct bytecode", function() {
      expect(pass).toChangeAST(grammar, bytecodeDetails([
        14, 0, 2, 2, 18, 0, 19, 1,   // <expression>
        10, 2, 0,                    // IF_ERROR
        2,                           //   * POP
        27                           //     PUSH_NULL
      ]));
    });

    it("defines correct constants", function() {
      expect(pass).toChangeAST(grammar, constsDetails([
        '"a"',
        '{ type: "literal", value: "a", description: "\\"a\\"" }'
      ]));
    });
  });

  describe("for zero_or_more", function() {
    var grammar = 'start = "a"*';

    it("generates correct bytecode", function() {
      expect(pass).toChangeAST(grammar, bytecodeDetails([
        29,                          // PUSH_EMPTY_ARRAY
        14, 0, 2, 2, 18, 0, 19, 1,   // <expression>
        12, 9,                       // WHILE_NOT_ERROR
        6,                           //   * APPEND
        14, 0, 2, 2, 18, 0, 19, 1,   //     <expression>
        2                            // POP
      ]));
    });

    it("defines correct constants", function() {
      expect(pass).toChangeAST(grammar, constsDetails([
        '"a"',
        '{ type: "literal", value: "a", description: "\\"a\\"" }'
      ]));
    });
  });

  describe("for one_or_more", function() {
    var grammar = 'start = "a"+';

    it("generates correct bytecode", function() {
      expect(pass).toChangeAST(grammar, bytecodeDetails([
        29,                          // PUSH_EMPTY_ARRAY
        14, 0, 2, 2, 18, 0, 19, 1,   // <expression>
        11, 12, 3,                   // IF_NOT_ERROR
        12, 9,                       //   * WHILE_NOT_ERROR
        6,                           //       * APPEND
        14, 0, 2, 2, 18, 0, 19, 1,   //         <expression>
        2,                           //     POP
        2,                           //   * POP
        2,                           //     POP
        28                           //     PUSH_FAILED
      ]));
    });

    it("defines correct constants", function() {
      expect(pass).toChangeAST(grammar, constsDetails([
        '"a"',
        '{ type: "literal", value: "a", description: "\\"a\\"" }'
      ]));
    });
  });

  describe("for semantic_and", function() {
    describe("without labels", function() {
      var grammar = 'start = &{ code }';

      it("generates correct bytecode", function() {
        expect(pass).toChangeAST(grammar, bytecodeDetails([
          23,            // UPDATE_CURR_POS
          26,            // SILENT_FAILS_ON
          24, 0, 0, 0,   // CALL
          27,            // SILENT_FAILS_OFF
          9, 2, 2,       // IF
          2,             //   * POP
          26,            //     PUSH_UNDEFINED
          2,             //   * POP
          28             //     PUSH_FAILED
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).toChangeAST(
          grammar,
          constsDetails(['function() { code }'])
        );
      });
    });

    describe("with labels", function() {
      var grammar = 'start = a:"a" b:"b" c:"c" &{ code }';

      it("generates correct bytecode", function() {
        expect(pass).toChangeAST(grammar, bytecodeDetails([
          1,                           // PUSH_CURR_POS
          16, 0, 2, 2, 18, 0, 19, 1,   // <elements[0]>
          11, 55, 3,                   // IF_NOT_ERROR
          16, 2, 2, 2, 18, 2, 19, 3,   //   * <elements[1]>
          11, 40, 4,                   //     IF_NOT_ERROR
          16, 4, 2, 2, 18, 4, 19, 5,   //       * <elements[2]>
          11, 25, 4,                   //         IF_NOT_ERROR
          23,                          //           * UPDATE_CURR_POS
          26,                          //             SILENT_FAILS_ON
          22, 6, 0, 3, 2, 1, 0,        //             CALL
          27,                          //             SILENT_FAILS_OFF
          9, 2, 2,                     //             IF
          2,                           //               * POP
          26,                          //                 PUSH_UNDEFINED
          2,                           //               * POP
          28,                          //                 PUSH_FAILED
          11, 3, 4,                    //             IF_NOT_ERROR
          7, 4,                        //               * WRAP
          5,                           //                 NIP
          4, 4,                        //               * POP_N
          3,                           //                 POP_CURR_POS
          28,                          //                 PUSH_FAILED
          4, 3,                        //           * POP_N
          3,                           //             POP_CURR_POS
          28,                          //             PUSH_FAILED
          4, 2,                        //       * POP_N
          3,                           //         POP_CURR_POS
          28,                          //         PUSH_FAILED
          2,                           //   * POP
          3,                           //     POP_CURR_POS
          28                           //     PUSH_FAILED
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).toChangeAST(grammar, constsDetails([
          '"a"',
          '{ type: "literal", value: "a", description: "\\"a\\"" }',
          '"b"',
          '{ type: "literal", value: "b", description: "\\"b\\"" }',
          '"c"',
          '{ type: "literal", value: "c", description: "\\"c\\"" }',
          'function(a, b, c) { code }'
        ], [
          ['a', 'b', 'c'], ' code '
        ]));
      });
    });
  });

  describe("for semantic_not", function() {
    describe("without labels", function() {
      var grammar = 'start = !{ code }';

      it("generates correct bytecode", function() {
        expect(pass).toChangeAST(grammar, bytecodeDetails([
          23,            // UPDATE_CURR_POS
          26,            // SILENT_FAILS_ON
          24, 0, 0, 0,   // CALL
          27,            // SILENT_FAILS_OFF
          9, 2, 2,       // IF
          2,             //   * POP
          28,            //     PUSH_FAILED
          2,             //   * POP
          26             //     PUSH_UNDEFINED
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).toChangeAST(
          grammar,
          constsDetails(['function() { code }'])
        );
      });
    });

    describe("with labels", function() {
      var grammar = 'start = a:"a" b:"b" c:"c" !{ code }';

      it("generates correct bytecode", function() {
        expect(pass).toChangeAST(grammar, bytecodeDetails([
          1,                           // PUSH_CURR_POS
          16, 0, 2, 2, 18, 0, 19, 1,   // <elements[0]>
          11, 55, 3,                   // IF_NOT_ERROR
          16, 2, 2, 2, 18, 2, 19, 3,   //   * <elements[1]>
          11, 40, 4,                   //     IF_NOT_ERROR
          16, 4, 2, 2, 18, 4, 19, 5,   //       * <elements[2]>
          11, 25, 4,                   //         IF_NOT_ERROR
          23,                          //           * UPDATE_CURR_POS
          26,                          //             SILENT_FAILS_ON
          22, 6, 0, 3, 2, 1, 0,        //             CALL
          27,                          //             SILENT_FAILS_OFF
          9, 2, 2,                     //             IF
          2,                           //               * POP
          28,                          //                 PUSH_FAILED
          2,                           //               * POP
          26,                          //                 PUSH_UNDEFINED
          11, 3, 4,                    //             IF_NOT_ERROR
          7, 4,                        //               * WRAP
          5,                           //                 NIP
          4, 4,                        //               * POP_N
          3,                           //                 POP_CURR_POS
          28,                          //                 PUSH_FAILED
          4, 3,                        //           * POP_N
          3,                           //             POP_CURR_POS
          28,                          //             PUSH_FAILED
          4, 2,                        //       * POP_N
          3,                           //         POP_CURR_POS
          28,                          //         PUSH_FAILED
          2,                           //   * POP
          3,                           //     POP_CURR_POS
          28                           //     PUSH_FAILED
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).toChangeAST(grammar, constsDetails([
          '"a"',
          '{ type: "literal", value: "a", description: "\\"a\\"" }',
          '"b"',
          '{ type: "literal", value: "b", description: "\\"b\\"" }',
          '"c"',
          '{ type: "literal", value: "c", description: "\\"c\\"" }',
          'function(a, b, c) { code }'
        ], [
          ['a', 'b', 'c'], ' code '
        ]));
      });
    });
  });

  describe("for range", function() {
    describe("| .. | (edge case -- no boundaries)", function() {
      var grammar = 'start = "a"| .. |';

      it("generates correct bytecode", function() {
        expect(pass).toChangeAST(grammar, bytecodeDetails([
          29,                          // PUSH_EMPTY_ARRAY
          14, 0, 2, 2, 18, 0, 19, 1,   // <expression>
          12, 9,                       // WHILE_NOT_ERROR
          6,                           //   * APPEND
          14, 0, 2, 2, 18, 0, 19, 1,   //     <expression>
          2                            // POP
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).toChangeAST(grammar, constsDetails([
          '"a"',
          '{ type: "literal", value: "a", description: "\\"a\\"" }'
        ]));
      });
    });

    describe("| ..3| (edge case -- no min boundary)", function() {
      var grammar = 'start = "a"| ..3|';

      it("generates correct bytecode", function() {
        expect(pass).toChangeAST(grammar, bytecodeDetails([
          29,                          // PUSH_EMPTY_ARRAY
          14, 0, 2, 2, 18, 0, 19, 1,   // <expression>
          12, 14,                      // WHILE_NOT_ERROR
          6,                           //   * APPEND
          31, 3, 1, 8,                 //     IF_ARRLEN_MAX
          28,                          //       * PUSH_FAILED
          14, 0, 2, 2, 18, 0, 19, 1,   //       * <expression>
          2                            // POP
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).toChangeAST(grammar, constsDetails([
          '"a"',
          '{ type: "literal", value: "a", description: "\\"a\\"" }'
        ]));
      });
    });

    describe("| ..1| (edge case -- no min boundary -- same as |optional|)", function() {
      var grammar = 'start = "a"| ..1|';

      it("generates correct bytecode", function() {
        expect(pass).toChangeAST(grammar, bytecodeDetails([
          29,                          // PUSH_EMPTY_ARRAY
          14, 0, 2, 2, 18, 0, 19, 1,   // <expression>
          12, 14,                      // WHILE_NOT_ERROR
          6,                           //   * APPEND
          31, 1, 1, 8,                 //     IF_ARRLEN_MAX
          28,                          //       * PUSH_FAILED
          14, 0, 2, 2, 18, 0, 19, 1,   //       * <expression>
          2                            // POP
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).toChangeAST(grammar, constsDetails([
          '"a"',
          '{ type: "literal", value: "a", description: "\\"a\\"" }'
        ]));
      });
    });

    describe("|2.. | (edge case -- no max boundary)", function() {
      var grammar = 'start = "a"|2.. |';

      it("generates correct bytecode", function() {
        expect(pass).toChangeAST(grammar, bytecodeDetails([
          29,                          // PUSH_EMPTY_ARRAY
          14, 0, 2, 2, 18, 0, 19, 1,   // <expression>
          12, 9,                       // WHILE_NOT_ERROR
          6,                           //   * APPEND
          14, 0, 2, 2, 18, 0, 19, 1,   //     <expression>
          2,                           // POP
          30, 2, 2, 0,                 // IF_ARRLEN_MIN
          2,                           //   * POP
          28                           //     PUSH_FAILED
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).toChangeAST(grammar, constsDetails([
          '"a"',
          '{ type: "literal", value: "a", description: "\\"a\\"" }'
        ]));
      });
    });

    describe("|0.. | (edge case -- no max boundary -- same as |zero or more|)", function() {
      var grammar = 'start = "a"|0.. |';

      it("generates correct bytecode", function() {
        expect(pass).toChangeAST(grammar, bytecodeDetails([
          29,                          // PUSH_EMPTY_ARRAY
          14, 0, 2, 2, 18, 0, 19, 1,   // <expression>
          12, 9,                       // WHILE_NOT_ERROR
          6,                           //   * APPEND
          14, 0, 2, 2, 18, 0, 19, 1,   //     <expression>
          2,                           // POP
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).toChangeAST(grammar, constsDetails([
          '"a"',
          '{ type: "literal", value: "a", description: "\\"a\\"" }'
        ]));
      });
    });

    describe("|1.. | (edge case -- no max boundary -- same as |one or more|)", function() {
      var grammar = 'start = "a"|1.. |';

      it("generates correct bytecode", function() {
        expect(pass).toChangeAST(grammar, bytecodeDetails([
          29,                          // PUSH_EMPTY_ARRAY
          14, 0, 2, 2, 18, 0, 19, 1,   // <expression>
          12, 9,                       // WHILE_NOT_ERROR
          6,                           //   * APPEND
          14, 0, 2, 2, 18, 0, 19, 1,   //     <expression>
          2,                           // POP
          30, 1, 2, 0,                 // IF_ARRLEN_MIN
          2,                           //   * POP
          28                           //     PUSH_FAILED
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).toChangeAST(grammar, constsDetails([
          '"a"',
          '{ type: "literal", value: "a", description: "\\"a\\"" }'
        ]));
      });
    });

    describe("|2..3|", function() {
      var grammar = 'start = "a"|2..3|';

      it("generates correct bytecode", function() {
        expect(pass).toChangeAST(grammar, bytecodeDetails([
          29,                          // PUSH_EMPTY_ARRAY
          14, 0, 2, 2, 18, 0, 19, 1,   // <expression>
          12, 14,                      // WHILE_NOT_ERROR
          6,                           //   * APPEND
          31, 3, 1, 8,                 //     IF_ARRLEN_MAX
          28,                          //       * PUSH_FAILED
          14, 0, 2, 2, 18, 0, 19, 1,   //       * <expression>
          2,                           // POP
          30, 2, 2, 0,                 // IF_ARRLEN_MIN
          2,                           //   * POP
          28                           //     PUSH_FAILED
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).toChangeAST(grammar, constsDetails([
          '"a"',
          '{ type: "literal", value: "a", description: "\\"a\\"" }'
        ]));
      });
    });

    describe("|42| (edge case -- exact repetitions)", function() {
      var grammar = 'start = "a"|42|';

      it("generates correct bytecode", function() {
        expect(pass).toChangeAST(grammar, bytecodeDetails([
          29,                          // PUSH_EMPTY_ARRAY
          14, 0, 2, 2, 18, 0, 19, 1,   // <expression>
          12, 14,                      // WHILE_NOT_ERROR
          6,                           //   * APPEND
          31, 42, 1, 8,                //     IF_ARRLEN_MAX
          28,                          //       * PUSH_FAILED
          14, 0, 2, 2, 18, 0, 19, 1,   //       * <expression>
          2,                           // POP
          30, 42, 2, 0,                // IF_ARRLEN_MIN
          2,                           //   * POP
          28                           //     PUSH_FAILED
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).toChangeAST(grammar, constsDetails([
          '"a"',
          '{ type: "literal", value: "a", description: "\\"a\\"" }'
        ]));
      });
    });
  });

  describe("for rule_ref", function() {
    it("generates correct bytecode", function() {
      expect(pass).toChangeAST([
        'start = other',
        'other = "other"'
      ].join("\n"), {
        rules: [
          {
            bytecode: [25, 1]   // RULE
          },
          { }
        ]
      });
    });
  });

  describe("for literal", function() {
    describe("empty", function() {
      var grammar = 'start = ""';

      it("generates correct bytecode", function() {
        expect(pass).toChangeAST(grammar, bytecodeDetails([
          0, 0   // PUSH
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).toChangeAST(grammar, constsDetails(['""']));
      });
    });

    describe("non-empty case-sensitive", function() {
      var grammar = 'start = "a"';

      it("generates correct bytecode", function() {
        expect(pass).toChangeAST(grammar, bytecodeDetails([
          16, 0, 2, 2,   // MATCH_STRING
          20, 0,         //   * ACCEPT_STRING
          21, 1          //   * FAIL
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).toChangeAST(grammar, constsDetails([
          '"a"',
          '{ type: "literal", value: "a", description: "\\"a\\"" }'
        ]));
      });
    });

    describe("non-empty case-insensitive", function() {
      var grammar = 'start = "A"i';

      it("generates correct bytecode", function() {
        expect(pass).toChangeAST(grammar, bytecodeDetails([
          17, 0, 2, 2,   // MATCH_STRING_IC
          19, 1,         //   * ACCEPT_N
          21, 1          //   * FAIL
        ]));
      });

      it("defines correct constants", function() {
        expect(pass).toChangeAST(grammar, constsDetails([
          '"a"',
          '{ type: "literal", value: "A", description: "\\"A\\"" }'
        ]));
      });
    });
  });

  describe("for class", function() {
    it("generates correct bytecode", function() {
      expect(pass).toChangeAST('start = [a]', bytecodeDetails([
        18, 0, 2, 2,   // MATCH_REGEXP
        19, 1,         //   * ACCEPT_N
        21, 1          //   * FAIL
      ]));
    });

    describe("non-empty non-inverted case-sensitive", function() {
      it("defines correct constants", function() {
        expect(pass).toChangeAST('start = [a]', constsDetails([
          '/^[a]/',
          '{ type: "class", value: "[a]", description: "[a]" }'
        ]));
      });
    });

    describe("non-empty inverted case-sensitive", function() {
      it("defines correct constants", function() {
        expect(pass).toChangeAST('start = [^a]', constsDetails([
          '/^[^a]/',
          '{ type: "class", value: "[^a]", description: "[^a]" }'
        ]));
      });
    });

    describe("non-empty non-inverted case-insensitive", function() {
      it("defines correct constants", function() {
        expect(pass).toChangeAST('start = [a]i', constsDetails([
          '/^[a]/i',
          '{ type: "class", value: "[a]i", description: "[a]i" }'
        ]));
      });
    });

    describe("non-empty complex", function() {
      it("defines correct constants", function() {
        expect(pass).toChangeAST('start = [ab-def-hij-l]', constsDetails([
          '/^[ab-def-hij-l]/',
          '{ type: "class", value: "[ab-def-hij-l]", description: "[ab-def-hij-l]" }'
        ]));
      });
    });

    describe("empty non-inverted", function() {
      it("defines correct constants", function() {
        expect(pass).toChangeAST('start = []', constsDetails([
          '/^(?!)/',
          '{ type: "class", value: "[]", description: "[]" }'
        ]));
      });
    });

    describe("empty inverted", function() {
      it("defines correct constants", function() {
        expect(pass).toChangeAST('start = [^]', constsDetails([
          '/^[\\S\\s]/',
          '{ type: "class", value: "[^]", description: "[^]" }'
        ]));
      });
    });
  });

  describe("for any", function() {
    var grammar = 'start = .';

    it("generates bytecode", function() {
      expect(pass).toChangeAST(grammar, bytecodeDetails([
        15, 2, 2,   // MATCH_ANY
        19, 1,      //   * ACCEPT_N
        21, 0       //   * FAIL
      ]));
    });

    it("defines correct constants", function() {
      expect(pass).toChangeAST(
        grammar,
        constsDetails(['{ type: "any", description: "any character" }'])
      );
    });
  });
});
