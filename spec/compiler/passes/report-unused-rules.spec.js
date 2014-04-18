// TODO: write a proper spec for this one!

describe("compiler pass |reportUnusedRules|", function() {
  var pass = PEG.compiler.passes.check.reportUnusedRules;
  function construct(constructor, args) {
    function F() {
      return constructor.apply(this, args);
    }
    F.prototype = constructor.prototype;
    return new F();
  }
  var collector = {
    emitFatalError: function() {
      throw construct(PEG.GrammarError, arguments);
    },
    emitError: function() {
      throw construct(PEG.GrammarError, arguments);
    },
    emitWarning: function() {
      throw construct(PEG.GrammarError, arguments);
    },
    emitInfo: function() {
      //throw construct(PEG.GrammarError, arguments);
    }
  };

  beforeEach(function() {
    this.addMatchers({
      toReportUnusedRuleIn: function(grammar, line, column) {
        var ast = PEG.parser.parse(grammar);

        try {
          this.actual(ast, {collector: collector});

          this.message = function() {
            return "Expected the pass to report a unused rule for grammar "
                 + jasmine.pp(grammar) + ", "
                 + "but it didn't.";
          };

          return false;
        } catch (e) {
          if (this.isNot) {
            this.message = function() {
              return "Expected the pass not to report a unused rule for grammar "
                   + jasmine.pp(grammar) + ", "
                   + "but it did.";
            };
          } else {
            this.message = function() {
              return "Expected the pass to report a unused rule for grammar "
                   + jasmine.pp(grammar) + ", "
                   + "but it reported an error with message "
                   + jasmine.pp(e.message) + ".";
            };
          }

          return e.message === 'Line '+line+', column '+column+': Referenced rule "unused" does not exist.';
        }
      }
    });
  });

  it("reports unused rule referenced from a rule", function() {
    expect(pass).toReportUnusedRuleIn('start = unused', 1, 9);
  });

  it("reports unused rule referenced from a named", function() {
    expect(pass).toReportUnusedRuleIn('start "start" = unused', 1, 17);
  });

  it("reports unused rule referenced from a choice", function() {
    expect(pass).toReportUnusedRuleIn('start = unused / "a" / "b"', 1, 9);
    expect(pass).toReportUnusedRuleIn('start = "a" / "b" / unused', 1, 21);
  });

  it("reports unused rule referenced from an action", function() {
    expect(pass).toReportUnusedRuleIn('start = unused { }', 1, 9);
  });

  it("reports unused rule referenced from a sequence", function() {
    expect(pass).toReportUnusedRuleIn('start = unused "a" "b"', 1, 9);
    expect(pass).toReportUnusedRuleIn('start = "a" "b" unused', 1, 17);
  });

  it("reports unused rule referenced from a labeled", function() {
    expect(pass).toReportUnusedRuleIn('start = label:unused', 1, 15);
  });

  it("reports unused rule referenced from a text", function() {
    expect(pass).toReportUnusedRuleIn('start = $unused', 1, 10);
  });

  it("reports unused rule referenced from a simple and", function() {
    expect(pass).toReportUnusedRuleIn('start = &unused', 1, 10);
  });

  it("reports unused rule referenced from a simple not", function() {
    expect(pass).toReportUnusedRuleIn('start = !unused', 1, 10);
  });

  it("reports unused rule referenced from an optional", function() {
    expect(pass).toReportUnusedRuleIn('start = unused?', 1, 9);
  });

  it("reports unused rule referenced from a zero or more", function() {
    expect(pass).toReportUnusedRuleIn('start = unused*', 1, 9);
  });

  it("reports unused rule referenced from a one or more", function() {
    expect(pass).toReportUnusedRuleIn('start = unused+', 1, 9);
  });

  describe("reports unused rule referenced from a range", function() {
    it("expression", function() {
      expect(pass).toReportUnusedRuleIn('start = unused|2..3|', 1, 9);
    });

    it("delimiter", function() {
      expect(pass).toReportUnusedRuleIn('start = "a"|2..3, unused|', 1, 19);
    });
  });
});
