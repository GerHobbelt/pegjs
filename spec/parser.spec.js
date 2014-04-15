describe("PEG.js grammar parser", function() {
  var literalAbcd       = { type: "literal",      value: "abcd", ignoreCase: false },
      literalEfgh       = { type: "literal",      value: "efgh", ignoreCase: false },
      literalIjkl       = { type: "literal",      value: "ijkl", ignoreCase: false },
      literalMnop       = { type: "literal",      value: "mnop", ignoreCase: false },
      semanticAnd       = { type: "semantic_and", code: " code " },
      semanticNot       = { type: "semantic_not", code: " code " },
      optional          = { type: "optional",     expression: literalAbcd },
      zeroOrMore        = { type: "zero_or_more", expression: literalAbcd },
      oneOrMore         = { type: "one_or_more",  expression: literalAbcd },
      textOptional      = { type: "text",         expression: optional    },
      simpleNotAbcd     = { type: "simple_not",   expression: literalAbcd },
      simpleAndOptional = { type: "simple_and",   expression: optional    },
      simpleNotOptional = { type: "simple_not",   expression: optional    },
      labeledAbcd       = { type: "labeled",      label: "a", expression: literalAbcd   },
      labeledEfgh       = { type: "labeled",      label: "b", expression: literalEfgh   },
      labeledIjkl       = { type: "labeled",      label: "c", expression: literalIjkl   },
      labeledMnop       = { type: "labeled",      label: "d", expression: literalMnop   },
      labeledSimpleNot  = { type: "labeled",      label: "a", expression: simpleNotAbcd },
      sequence          = {
        type:     "sequence",
        elements: [literalAbcd, literalEfgh, literalIjkl]
      },
      sequence2         = {
        type:     "sequence",
        elements: [labeledAbcd, labeledEfgh]
      },
      sequence4         = {
        type:     "sequence",
        elements: [labeledAbcd, labeledEfgh, labeledIjkl, labeledMnop]
      },
      actionAbcd        = { type: "action", expression: literalAbcd, code: " code " },
      actionEfgh        = { type: "action", expression: literalEfgh, code: " code " },
      actionIjkl        = { type: "action", expression: literalIjkl, code: " code " },
      actionMnop        = { type: "action", expression: literalMnop, code: " code " },
      actionSequence    = { type: "action", expression: sequence,    code: " code " },
      choice            = {
        type:         "choice",
        alternatives: [literalAbcd, literalEfgh, literalIjkl]
      },
      choice2           = {
        type:         "choice",
        alternatives: [actionAbcd, actionEfgh]
      },
      choice4           = {
        type:         "choice",
        alternatives: [actionAbcd, actionEfgh, actionIjkl, actionMnop]
      },
      named             = { type: "named",       name: "start rule", expression: literalAbcd },
      ruleA             = { type: "rule",        name: "a",          annotations: [], expression: literalAbcd },
      ruleB             = { type: "rule",        name: "b",          annotations: [], expression: literalEfgh },
      ruleC             = { type: "rule",        name: "c",          annotations: [], expression: literalIjkl },
      ruleStart         = { type: "rule",        name: "start",      annotations: [], expression: literalAbcd },
      initializer       = { type: "initializer", code: " code " };

  function oneRuleGrammar(expression) {
    return {
      type:        "grammar",
      initializer: null,
      rules:       [
        {
          type: "rule",
          name: "start",
          annotations: [],
          expression: expression
        }
      ]
    };
  }

  function actionGrammar(code) {
    return oneRuleGrammar(
      {
        type: "action",
        expression: literalAbcd,
        code: code
      }
    );
  }

  function literalGrammar(value, ignoreCase) {
    return oneRuleGrammar(
      {
        type: "literal",
        value: value,
        ignoreCase: ignoreCase
      }
    );
  }

  function classGrammar(parts, inverted, ignoreCase, rawText) {
    return oneRuleGrammar({
      type:       "class",
      parts:      parts,
      inverted:   inverted,
      ignoreCase: ignoreCase,
      rawText:    rawText
    });
  }

  function anyGrammar() {
    return oneRuleGrammar({ type: "any" });
  }

  function ruleRefGrammar(name) {
    return oneRuleGrammar({ type: "rule_ref", name: name });
  }

  function rangeGrammar(min, max) {
    return oneRuleGrammar({
      type: "range",
      min: min,
      max: max,
      expression: literalAbcd,
      delimiter: null
    });
  }

  function range2Grammar(min, max) {
    return oneRuleGrammar({
      type: "range",
      min: min,
      max: max,
      expression: literalAbcd,
      delimiter: literalEfgh
    });
  }

  var trivialGrammar = literalGrammar("abcd", false),
      twoRuleGrammar = {
        type:        "grammar",
        initializer: null,
        rules:       [ruleA, ruleB]
      };

  beforeEach(function() {
    this.addMatchers({
      toParseAs:     function(expected) {
        var result;

        function buildNodeVisitor(functions) {
          return function(node) {
            return functions[node.type].apply(null, arguments);
          };
        }
        function rm(node) {delete node.region;}
        function doInExpression(node) {
          rm(node);
          removeRegionKey(node.expression);
        }
        function doInSubnodes(propertyName) {
          return function(node) {
            rm(node);
            var arr = node[propertyName];
            for (var i = 0; i < arr.length; ++i) {
              removeRegionKey(arr[i]);
            };
          };
        }
        var removeRegionKey = buildNodeVisitor({
          grammar:      function(node) {
            doInSubnodes("rules")(node);
            if (node.initializer) {
              removeRegionKey(node.initializer);
            }
          },
          initializer:  rm,
          rule:         doInExpression,
          named:        doInExpression,
          choice:       doInSubnodes("alternatives"),
          action:       doInExpression,
          sequence:     doInSubnodes("elements"),
          labeled:      doInExpression,
          text:         doInExpression,
          simple_and:   doInExpression,
          simple_not:   doInExpression,
          semantic_and: rm,
          semantic_not: rm,
          optional:     doInExpression,
          zero_or_more: doInExpression,
          one_or_more:  doInExpression,
          range:        function(node) {
            rm(node);
            removeRegionKey(node.expression);
            if (node.delimiter) {
              removeRegionKey(node.delimiter);
            }
          },
          rule_ref:     rm,
          literal:      rm,
          "class":      rm,
          any:          rm
        });

        try {
          result = PEG.parser.parse(this.actual);
          // Remove |node.region| from each node, becouse we don't check it there.
          removeRegionKey(result);

          this.message = function() {
            return "Expected " + jasmine.pp(this.actual) + " "
                 + (this.isNot ? "not " : "")
                 + "to parse as " + jasmine.pp(expected) + ", "
                 + "but it parsed as " + jasmine.pp(result) + ".";
          };

          return this.env.equals_(result, expected);
        } catch (e) {
          this.message = function() {
            return "Expected " + jasmine.pp(this.actual) + " "
                 + "to parse as " + jasmine.pp(expected) + ", "
                 + "but it failed to parse with message "
                 + jasmine.pp(e.message) + ".";
          };

          return false;
        }
      },

      toFailToParse: function(details) {
        /*
         * Extracted into a function just to silence JSHint complaining about
         * creating functions in a loop.
         */
        function buildKeyMessage(key, value) {
          return function() {
            return "Expected " + jasmine.pp(this.actual) + " to fail to parse"
                 + (details ? " with details " + jasmine.pp(details) : "") + ", "
                 + "but " + jasmine.pp(key) + " "
                 + "is " + jasmine.pp(value) + ".";
          };
        }

        var result;

        try {
          result = PEG.parser.parse(this.actual);

          this.message = function() {
            return "Expected " + jasmine.pp(this.actual) + " to fail to parse"
                 + (details ? " with details " + jasmine.pp(details) : "") + ", "
                 + "but it parsed as " + jasmine.pp(result) + ".";
          };

          return false;
        } catch (e) {
          /*
           * Should be at the top level but then JSHint complains about bad for
           * in variable.
           */
          var key;

          if (this.isNot) {
            this.message = function() {
              return "Expected " + jasmine.pp(this.actual) + " to parse, "
                   + "but it failed with message "
                   + jasmine.pp(e.message) + ".";
            };
          } else {
            if (details) {
              for (key in details) {
                if (details.hasOwnProperty(key)) {
                  if (!this.env.equals_(e[key], details[key])) {
                    this.message = buildKeyMessage(key, e[key]);

                    return false;
                  }
                }
              }
            }
          }

          return true;
        }
      }
    });
  });

  /* Canonical Grammar is "a = \"abcd\"; b = \"efgh\"; c = \"ijkl\";". */
  it("parses Grammar", function() {
    expect('\na = "abcd";\n').toParseAs(
      {
        type:  "grammar",
        initializer: null,
        rules: [ruleA]
      }
    );
    expect('\na = "abcd";\nb = "efgh";\nc = "ijkl";\n').toParseAs(
      {
        type:  "grammar",
        initializer: null,
        rules: [ruleA, ruleB, ruleC]
      }
    );
    expect('\n{ code };\na = "abcd";\n').toParseAs(
      {
        type:  "grammar",
        initializer: initializer,
        rules: [ruleA]
      }
    );
  });

  /* Canonical Initializer is "{ code }". */
  it("parses Initializer", function() {
    expect('{ code };start = "abcd"').toParseAs(
      {
        type:  "grammar",
        initializer: initializer,
        rules: [ruleStart]
      }
    );
  });

  /* Canonical Rule is "a = \"abcd\";". */
  it("parses Rule", function() {
    expect('start\n=\n"abcd";').toParseAs(
      oneRuleGrammar(literalAbcd)
    );
    expect('start\n"start rule"\n=\n"abcd";').toParseAs(
      oneRuleGrammar(named)
    );
  });

  /* Canonical Expression is "\"abcd\"". */
  it("parses Expression", function() {
    expect('start = "abcd" / "efgh" / "ijkl"').toParseAs(
      oneRuleGrammar(choice)
    );
  });

  /* Canonical ChoiceExpression is "\"abcd\" / \"efgh\" / \"ijkl\"". */
  it("parses ChoiceExpression", function() {
    expect('start = "abcd" { code }').toParseAs(
      oneRuleGrammar(actionAbcd)
    );
    expect('start = "abcd" { code }\n/\n"efgh" { code }').toParseAs(
      oneRuleGrammar(choice2)
    );
    expect(
      'start = "abcd" { code }\n/\n"efgh" { code }\n/\n"ijkl" { code }\n/\n"mnop" { code }'
    ).toParseAs(
      oneRuleGrammar(choice4)
    );
  });

  /* Canonical ActionExpression is "\"abcd\" { code }". */
  it("parses ActionExpression", function() {
    expect('start = "abcd" "efgh" "ijkl"').toParseAs(
      oneRuleGrammar(sequence)
    );
    expect('start = "abcd" "efgh" "ijkl"\n{ code }').toParseAs(
      oneRuleGrammar(actionSequence)
    );
  });

  /* Canonical SequenceExpression is "\"abcd\" \"efgh\" \"ijkl\"". */
  it("parses SequenceExpression", function() {
    expect('start = a:"abcd"').toParseAs(
      oneRuleGrammar(labeledAbcd)
    );
    expect('start = a:"abcd"\nb:"efgh"').toParseAs(
      oneRuleGrammar(sequence2)
    );
    expect('start = a:"abcd"\nb:"efgh"\nc:"ijkl"\nd:"mnop"').toParseAs(
      oneRuleGrammar(sequence4)
    );
  });

  /* Canonical LabeledExpression is "a:\"abcd\"". */
  it("parses LabeledExpression", function() {
    expect('start = a\n:\n!"abcd"').toParseAs(oneRuleGrammar(labeledSimpleNot));
    expect('start = !"abcd"'      ).toParseAs(oneRuleGrammar(simpleNotAbcd));
  });

  /* Canonical PrefixedExpression is "!\"abcd\"". */
  it("parses PrefixedExpression", function() {
    expect('start = !\n"abcd"?' ).toParseAs(oneRuleGrammar(simpleNotOptional));
    expect('start = "abcd"?'    ).toParseAs(oneRuleGrammar(optional));
  });

  /* Canonical PrefixedOperator is "!". */
  it("parses PrefixedOperator", function() {
    expect('start = $"abcd"?').toParseAs(oneRuleGrammar(textOptional));
    expect('start = &"abcd"?').toParseAs(oneRuleGrammar(simpleAndOptional));
    expect('start = !"abcd"?').toParseAs(oneRuleGrammar(simpleNotOptional));
  });

  /* Canonical SuffixedExpression is "\"ebcd\"?". */
  it("parses SuffixedExpression", function() {
    expect('start = "abcd"\n?').toParseAs(oneRuleGrammar(optional));
    expect('start = "abcd"'   ).toParseAs(oneRuleGrammar(literalAbcd));
  });

  /* Canonical SuffixedOperator is "?". */
  it("parses SuffixedOperator", function() {
    expect('start = "abcd"?').toParseAs(oneRuleGrammar(optional));
    expect('start = "abcd"*').toParseAs(oneRuleGrammar(zeroOrMore));
    expect('start = "abcd"+').toParseAs(oneRuleGrammar(oneOrMore));

    expect('start = "abcd"| .. |').toParseAs(rangeGrammar(0, null));
    expect('start = "abcd"| ..3|').toParseAs(rangeGrammar(0,    3));
    expect('start = "abcd"|2.. |').toParseAs(rangeGrammar(2, null));
    expect('start = "abcd"|2..3|').toParseAs(rangeGrammar(2,    3));

    expect('start = "abcd"| .. , "efgh"|').toParseAs(range2Grammar(0, null));
    expect('start = "abcd"| ..3, "efgh"|').toParseAs(range2Grammar(0,    3));
    expect('start = "abcd"|2.. , "efgh"|').toParseAs(range2Grammar(2, null));
    expect('start = "abcd"|2..3, "efgh"|').toParseAs(range2Grammar(2,    3));
  });

  /* Canonical PrimaryExpression is "\"abcd\"". */
  it("parses PrimaryExpression", function() {
    expect('start = "abcd"'      ).toParseAs(trivialGrammar);
    expect('start = [a-d]'       ).toParseAs(classGrammar([["a", "d"]], false, false, "[a-d]"));
    expect('start = .'           ).toParseAs(anyGrammar());
    expect('start = a'           ).toParseAs(ruleRefGrammar("a"));
    expect('start = &{ code }'   ).toParseAs(oneRuleGrammar(semanticAnd));
    expect('start = (\n"abcd"\n)').toParseAs(trivialGrammar);
  });

  /* Canonical RuleReferenceExpression is "a". */
  it("parses RuleReferenceExpression", function() {
    expect('start = a').toParseAs(ruleRefGrammar("a"));

    expect('start = a\n='        ).toFailToParse();
    expect('start = a\n"abcd"\n=').toFailToParse();
  });

  /* Canonical SemanticPredicateExpression is "!{ code }". */
  it("parses SemanticPredicateExpression", function() {
    expect('start = !\n{ code }').toParseAs(oneRuleGrammar(semanticNot));
  });

  /* Canonical SemanticPredicateOperator is "!". */
  it("parses SemanticPredicateOperator", function() {
    expect('start = &{ code }').toParseAs(oneRuleGrammar(semanticAnd));
    expect('start = !{ code }').toParseAs(oneRuleGrammar(semanticNot));
  });

  /* The SourceCharacter rule is not tested. */

  /* Canonical WhiteSpace is " ". */
  it("parses WhiteSpace", function() {
    expect('start =\t"abcd"'    ).toParseAs(trivialGrammar);
    expect('start =\x0B"abcd"'  ).toParseAs(trivialGrammar);   // no "\v" in IE
    expect('start =\f"abcd"'    ).toParseAs(trivialGrammar);
    expect('start = "abcd"'     ).toParseAs(trivialGrammar);
    expect('start =\u00A0"abcd"').toParseAs(trivialGrammar);
    expect('start =\uFEFF"abcd"').toParseAs(trivialGrammar);
    expect('start =\u1680"abcd"').toParseAs(trivialGrammar);
  });

  /* Canonical LineTerminator is "\n". */
  it("parses LineTerminator", function() {
    expect('start = "\n"'    ).toFailToParse();
    expect('start = "\r"'    ).toFailToParse();
    expect('start = "\u2028"').toFailToParse();
    expect('start = "\u2029"').toFailToParse();
  });

  /* Canonical LineTerminatorSequence is "\r\n". */
  it("parses LineTerminatorSequence", function() {
    expect('start =\n"abcd"'    ).toParseAs(trivialGrammar);
    expect('start =\r\n"abcd"'  ).toParseAs(trivialGrammar);
    expect('start =\r"abcd"'    ).toParseAs(trivialGrammar);
    expect('start =\u2028"abcd"').toParseAs(trivialGrammar);
    expect('start =\u2029"abcd"').toParseAs(trivialGrammar);
  });

  // Canonical Comment is "/* comment */".
  it("parses Comment", function() {
    expect('start =// comment\n"abcd"' ).toParseAs(trivialGrammar);
    expect('start =/* comment */"abcd"').toParseAs(trivialGrammar);
  });

  // Canonical MultiLineComment is "/* comment */".
  it("parses MultiLineComment", function() {
    expect('start =/**/"abcd"'   ).toParseAs(trivialGrammar);
    expect('start =/*a*/"abcd"'  ).toParseAs(trivialGrammar);
    expect('start =/*abc*/"abcd"').toParseAs(trivialGrammar);

    expect('start =/**/*/"abcd"').toFailToParse();
  });

  // Canonical MultiLineCommentNoLineTerminator is "/* comment */".
  it("parses MultiLineCommentNoLineTerminator", function() {
    expect('a = "abcd"/**/\r\nb = "efgh"'   ).toParseAs(twoRuleGrammar);
    expect('a = "abcd"/*a*/\r\nb = "efgh"'  ).toParseAs(twoRuleGrammar);
    expect('a = "abcd"/*abc*/\r\nb = "efgh"').toParseAs(twoRuleGrammar);

    expect('a = "abcd"/**/*/\r\nb = "efgh"').toFailToParse();
    expect('a = "abcd"/*\n*/\r\nb = "efgh"').toFailToParse();
  });

  /* Canonical SingleLineComment is "// comment". */
  it("parses SingleLineComment", function() {
    expect('start =//\n"abcd"'   ).toParseAs(trivialGrammar);
    expect('start =//a\n"abcd"'  ).toParseAs(trivialGrammar);
    expect('start =//abc\n"abcd"').toParseAs(trivialGrammar);

    expect('start =//\n@\n"abcd"').toFailToParse();
  });

  /* Canonical Identifier is "a". */
  it("parses Identifier", function() {
    expect('start = a:"abcd"').toParseAs(oneRuleGrammar(labeledAbcd));
  });

  /* Canonical IdentifierName is "a". */
  it("parses IdentifierName", function() {
    expect('start = a'   ).toParseAs(ruleRefGrammar("a"));
    expect('start = ab'  ).toParseAs(ruleRefGrammar("ab"));
    expect('start = abcd').toParseAs(ruleRefGrammar("abcd"));
  });

  /* Canonical IdentifierStart is "a". */
  it("parses IdentifierStart", function() {
    expect('start = a'      ).toParseAs(ruleRefGrammar("a"));
    expect('start = $'      ).toParseAs(ruleRefGrammar("$"));
    expect('start = _'      ).toParseAs(ruleRefGrammar("_"));
    expect('start = \\u0061').toParseAs(ruleRefGrammar("a"));
  });

  /* Canonical IdentifierPart is "a". */
  it("parses IdentifierPart", function() {
    expect('start = aa'     ).toParseAs(ruleRefGrammar("aa"));
    expect('start = a\u0300').toParseAs(ruleRefGrammar("a\u0300"));
    expect('start = a0'     ).toParseAs(ruleRefGrammar("a0"));
    expect('start = a\u203F').toParseAs(ruleRefGrammar("a\u203F"));
    expect('start = a\u200C').toParseAs(ruleRefGrammar("a\u200C"));
    expect('start = a\u200D').toParseAs(ruleRefGrammar("a\u200D"));
  });

  /* Unicode rules and reserved word rules are not tested. */

  /* Canonical LiteralMatcher is "\"abcd\"". */
  it("parses LiteralMatcher", function() {
    expect('start = "abcd"' ).toParseAs(literalGrammar("abcd", false));
    expect('start = "abcd"i').toParseAs(literalGrammar("abcd", true));
  });

  /* Canonical StringLiteral is "\"abcd\"". */
  it("parses StringLiteral", function() {
    expect('start = ""'    ).toParseAs(literalGrammar("",    false));
    expect('start = "a"'   ).toParseAs(literalGrammar("a",   false));
    expect('start = "abc"' ).toParseAs(literalGrammar("abc", false));

    expect("start = ''"    ).toParseAs(literalGrammar("",    false));
    expect("start = 'a'"   ).toParseAs(literalGrammar("a",   false));
    expect("start = 'abc'" ).toParseAs(literalGrammar("abc", false));
  });

  /* Canonical DoubleStringCharacter is "a". */
  it("parses DoubleStringCharacter", function() {
    expect('start = "a"'   ).toParseAs(literalGrammar("a",  false));
    expect('start = "\\n"' ).toParseAs(literalGrammar("\n", false));
    expect('start = "\\\n"').toParseAs(literalGrammar("",   false));

    expect('start = """' ).toFailToParse();
    expect('start = "\\"').toFailToParse();
    expect('start = "\n"').toFailToParse();
  });

  /* Canonical SingleStringCharacter is "a". */
  it("parses SingleStringCharacter", function() {
    expect("start = 'a'"   ).toParseAs(literalGrammar("a",  false));
    expect("start = '\\n'" ).toParseAs(literalGrammar("\n", false));
    expect("start = '\\\n'").toParseAs(literalGrammar("",   false));

    expect("start = '''" ).toFailToParse();
    expect("start = '\\'").toFailToParse();
    expect("start = '\n'").toFailToParse();
  });

  /* Canonical CharacterClassMatcher is "[a-d]". */
  it("parses CharacterClassMatcher", function() {
    expect('start = []').toParseAs(
      classGrammar([], false, false, "[]")
    );
    expect('start = [a-d]').toParseAs(
      classGrammar([["a", "d"]], false, false, "[a-d]")
    );
    expect('start = [a]').toParseAs(
      classGrammar(["a"], false, false, "[a]")
    );
    expect('start = [a-de-hi-l]').toParseAs(
      classGrammar(
        [["a", "d"], ["e", "h"], ["i", "l"]],
        false,
        false,
        "[a-de-hi-l]"
      )
    );
    expect('start = [^a-d]').toParseAs(
      classGrammar([["a", "d"]], true, false, "[^a-d]")
    );
    expect('start = [a-d]i').toParseAs(
      classGrammar([["a", "d"]], false, true, "[a-d]i")
    );

    expect('start = [\\\n]').toParseAs(
      classGrammar([], false, false, "[\\\n]")
    );
  });

  /* Canonical ClassCharacterRange is "a-d". */
  it("parses ClassCharacterRange", function() {
    expect('start = [a-d]').toParseAs(
      classGrammar([["a", "d"]], false, false, "[a-d]")
    );

    expect('start = [a-a]').toParseAs(
      classGrammar([["a", "a"]], false, false, "[a-a]")
    );
    expect('start = [b-a]').toFailToParse({
      message: "Invalid character range: b-a."
    });
  });

  /* Canonical ClassCharacter is "a". */
  it("parses ClassCharacter", function() {
    expect('start = [a]'   ).toParseAs(
      classGrammar(["a"], false, false, "[a]")
    );
    expect('start = [\\n]' ).toParseAs(
      classGrammar(["\n"], false, false, "[\\n]")
    );
    expect('start = [\\\n]').toParseAs(
      classGrammar([], false, false, "[\\\n]")
    );

    expect('start = []]' ).toFailToParse();
    expect('start = [\\]').toFailToParse();
    expect('start = [\n]').toFailToParse();
  });

  /* Canonical LineContinuation is "\\\n". */
  it("parses LineContinuation", function() {
    expect('start = "\\\r\n"').toParseAs(literalGrammar("", false));
  });

  /* Canonical EscapeSequence is "n". */
  it("parses EscapeSequence", function() {
    expect('start = "\\n"'    ).toParseAs(literalGrammar("\n",     false));
    expect('start = "\\0"'    ).toParseAs(literalGrammar("\x00",   false));
    expect('start = "\\xFF"'  ).toParseAs(literalGrammar("\xFF",   false));
    expect('start = "\\uFFFF"').toParseAs(literalGrammar("\uFFFF", false));

    expect('start = "\\09"').toFailToParse();
  });

  /* Canonical CharacterEscapeSequence is "n". */
  it("parses CharacterEscapeSequence", function() {
    expect('start = "\\n"').toParseAs(literalGrammar("\n", false));
    expect('start = "\\a"').toParseAs(literalGrammar("a",  false));
  });

  /* Canonical SingleEscapeCharacter is "n". */
  it("parses SingleEscapeCharacter", function() {
    expect('start = "\\\'"').toParseAs(literalGrammar("'",    false));
    expect('start = "\\""' ).toParseAs(literalGrammar('"',    false));
    expect('start = "\\\\"').toParseAs(literalGrammar("\\",   false));
    expect('start = "\\b"' ).toParseAs(literalGrammar("\b",   false));
    expect('start = "\\f"' ).toParseAs(literalGrammar("\f",   false));
    expect('start = "\\n"' ).toParseAs(literalGrammar("\n",   false));
    expect('start = "\\r"' ).toParseAs(literalGrammar("\r",   false));
    expect('start = "\\t"' ).toParseAs(literalGrammar("\t",   false));
    expect('start = "\\v"' ).toParseAs(literalGrammar("\x0B", false));   // no "\v" in IE
  });

  /* Canonical NonEscapeCharacter is "a". */
  it("parses NonEscapeCharacter", function() {
    expect('start = "\\a"').toParseAs(literalGrammar("a", false));

    /*
     * The negative predicate is impossible to test with PEG.js grammar
     * structure.
     */
  });

  /*
   * The EscapeCharacter rule is impossible to test with PEG.js grammar
   * structure.
   */

  /* Canonical HexEscapeSequence is "xFF". */
  it("parses HexEscapeSequence", function() {
    expect('start = "\\xFF"').toParseAs(literalGrammar("\xFF", false));
  });

  /* Canonical UnicodeEscapeSequence is "uFFFF". */
  it("parses UnicodeEscapeSequence", function() {
    expect('start = "\\uFFFF"').toParseAs(literalGrammar("\uFFFF", false));
  });

  /* Digit rules are not tested. */

  /* Canonical AnyMatcher is ".". */
  it("parses AnyMatcher", function() {
    expect('start = .').toParseAs(anyGrammar());
  });

  /* Canonical CodeBlock is "{ code }". */
  it("parses CodeBlock", function() {
    expect('start = "abcd" { code }').toParseAs(actionGrammar(" code "));
  });

  /* Canonical Code is " code ". */
  it("parses Code", function() {
    expect('start = "abcd" {a}'        ).toParseAs(actionGrammar("a"));
    expect('start = "abcd" {abc}'      ).toParseAs(actionGrammar("abc"));
    expect('start = "abcd" {{a}}'      ).toParseAs(actionGrammar("{a}"));
    expect('start = "abcd" {{a}{b}{c}}').toParseAs(actionGrammar("{a}{b}{c}"));

    expect('start = "abcd" {{}').toFailToParse();
    expect('start = "abcd" {}}').toFailToParse();
  });

  /* Annotations */
  it("parses Annotations", function() {
    var grammar = oneRuleGrammar(literalAbcd);
    grammar.rules[0].annotations.push({ name: 'Annotation', params: [] });
    expect('@Annotation start = "abcd"').toParseAs(grammar);
    expect('@Annotation\nstart = "abcd"').toParseAs(grammar);
    expect('@Annotation()start = "abcd"').toParseAs(grammar);

    grammar.rules[0].annotations.push({ name: 'Annotation2', params: [] });
    expect('@Annotation @Annotation2 start = "abcd"').toParseAs(grammar);
    expect('@Annotation\n@Annotation2 start = "abcd"').toParseAs(grammar);
    expect('@Annotation()@Annotation2 start = "abcd"').toParseAs(grammar);

    grammar.rules[0].annotations = [{ name: 'Annotation', params: ['a'] }];
    expect('@Annotation(a) start = "abcd"').toParseAs(grammar);

    grammar.rules[0].annotations = [{ name: 'Annotation', params: ['a', 'b'] }];
    expect('@Annotation(a,b)start = "abcd"').toParseAs(grammar);
    expect('@Annotation(a,b,)start = "abcd"').toParseAs(grammar);
  });

  /* Unicode character category rules and token rules are not tested. */

  /* Canonical __ is "\n". */
  it("parses __", function() {
    expect('start ="abcd"'             ).toParseAs(trivialGrammar);
    expect('start = "abcd"'            ).toParseAs(trivialGrammar);
    expect('start =\r\n"abcd"'         ).toParseAs(trivialGrammar);
    expect('start =/* comment */"abcd"').toParseAs(trivialGrammar);
    expect('start =   "abcd"'          ).toParseAs(trivialGrammar);
  });

  /* Canonical _ is " ". */
  it("parses _", function() {
    expect('a = "abcd"\r\nb = "efgh"'             ).toParseAs(twoRuleGrammar);
    expect('a = "abcd" \r\nb = "efgh"'            ).toParseAs(twoRuleGrammar);
    expect('a = "abcd"/* comment */\r\nb = "efgh"').toParseAs(twoRuleGrammar);
    expect('a = "abcd"   \r\nb = "efgh"'          ).toParseAs(twoRuleGrammar);
  });

  /* Canonical EOS is ";". */
  it("parses EOS", function() {
    expect('a = "abcd"\n;b = "efgh"'            ).toParseAs(twoRuleGrammar);
    expect('a = "abcd" \r\nb = "efgh"'          ).toParseAs(twoRuleGrammar);
    expect('a = "abcd" // comment\r\nb = "efgh"').toParseAs(twoRuleGrammar);
    expect('a = "abcd"\nb = "efgh"'             ).toParseAs(twoRuleGrammar);
  });

  /* Canonical EOF is the end of input. */
  it("parses EOF", function() {
    expect('start = "abcd"\n').toParseAs(trivialGrammar);
  });

  /* Annotations */
  it("parses annotations", function() {
    var grammar = oneRuleGrammar(literalAbcd);
    grammar.rules[0].annotations.push({ name: 'Annotation', params: [] });
    expect('@Annotation start = "abcd"').toParseAs(grammar);
    expect('@Annotation\nstart = "abcd"').toParseAs(grammar);
    expect('@Annotation()start = "abcd"').toParseAs(grammar);

    grammar.rules[0].annotations.push({ name: 'Annotation2', params: [] });
    expect('@Annotation @Annotation2 start = "abcd"').toParseAs(grammar);
    expect('@Annotation\n@Annotation2 start = "abcd"').toParseAs(grammar);
    expect('@Annotation()@Annotation2 start = "abcd"').toParseAs(grammar);

    grammar.rules[0].annotations = [{ name: 'Annotation', params: ['a'] }];
    expect('@Annotation(a) start = "abcd"').toParseAs(grammar);

    grammar.rules[0].annotations = [{ name: 'Annotation', params: ['a', 'b'] }];
    expect('@Annotation(a,b)start = "abcd"').toParseAs(grammar);
    expect('@Annotation(a,b,)start = "abcd"').toParseAs(grammar);
  });

  /* Rule wildcards: ranges */
  it("parses ranges for rules", function() {
    expect('start = "abcd"| ..3|').toParseAs(oneRuleGrammar({
      type:       "range",
      min:        0,
      max:        3,
      expression: literalAbcd,
      delimiter:  undefined
    }));
    expect('start = "abcd"|2.. |').toParseAs(oneRuleGrammar({
      type:       "range",
      min:        2,
      max:        undefined,
      expression: literalAbcd,
      delimiter:  undefined
    }));
    expect('start = "abcd"|2..3|').toParseAs(oneRuleGrammar({
      type:       "range",
      min:        2,
      max:        3,
      expression: literalAbcd,
      delimiter:  undefined
    }));
    expect('start = "abcd"| ..3, "efgh"|').toParseAs(oneRuleGrammar({
      type:       "range",
      min:        0,
      max:        3,
      expression: literalAbcd,
      delimiter:  literalEfgh
    }));
    expect('start = "abcd"|2.. , "efgh"|').toParseAs(oneRuleGrammar({
      type:       "range",
      min:        2,
      max:        undefined,
      expression: literalAbcd,
      delimiter:  literalEfgh
    }));
    expect('start = "abcd"|2..3, "efgh"|').toParseAs(oneRuleGrammar({
      type:       "range",
      min:        2,
      max:        3,
      expression: literalAbcd,
      delimiter:  literalEfgh
    }));
    expect('start = "abcd"' ).toParseAs(literalGrammar("abcd"));
  });


});

