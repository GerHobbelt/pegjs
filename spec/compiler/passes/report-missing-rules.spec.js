describe("compiler pass |reportMissingRules|", function() {
  var pass = PEG.compiler.passes.check.reportMissingRules;
  function construct(constructor, args) {
    function F() {
      return constructor.apply(this, args);
    }
    F.prototype = constructor.prototype;
    return new F();
  };
  var collector = {
    emitError: function() {
      throw construct(PEG.GrammarError, arguments);
    },
  };

  beforeEach(function() {
    this.addMatchers({
      toReportMissingRuleIn: function(grammar, line, column) {
        var ast = PEG.parser.parse(grammar);

        try {
          this.actual(ast, {collector: collector});

          this.message = function() {
            return "Expected the pass to report a missing rule for grammar "
                 + jasmine.pp(grammar) + ", "
                 + "but it didn't.";
          };

          return false;
        } catch (e) {
          if (this.isNot) {
            this.message = function() {
              return "Expected the pass not to report a missing rule for grammar "
                   + jasmine.pp(grammar) + ", "
                   + "but it did.";
            };
          } else {
            this.message = function() {
              return "Expected the pass to report a missing rule for grammar "
                   + jasmine.pp(grammar) + ", "
                   + "but it reported an error with message "
                   + jasmine.pp(e.message) + ".";
            };
          }

          return e.message === 'Line '+line+', column '+column+': Referenced rule "missing" does not exist.';
        }
      }
    });
  });

  it("reports missing rule referenced from a rule", function() {
    expect(pass).toReportMissingRuleIn('start = missing', 1, 9);
  });

  it("reports missing rule referenced from a named", function() {
    expect(pass).toReportMissingRuleIn('start "start" = missing', 1, 17);
  });

  it("reports missing rule referenced from a choice", function() {
    expect(pass).toReportMissingRuleIn('start = missing / "a" / "b"', 1, 9);
    expect(pass).toReportMissingRuleIn('start = "a" / "b" / missing', 1, 21);
  });

  it("reports missing rule referenced from an action", function() {
    expect(pass).toReportMissingRuleIn('start = missing { }', 1, 9);
  });

  it("reports missing rule referenced from a sequence", function() {
    expect(pass).toReportMissingRuleIn('start = missing "a" "b"', 1, 9);
    expect(pass).toReportMissingRuleIn('start = "a" "b" missing', 1, 17);
  });

  it("reports missing rule referenced from a labeled", function() {
    expect(pass).toReportMissingRuleIn('start = label:missing', 1, 15);
  });

  it("reports missing rule referenced from a text", function() {
    expect(pass).toReportMissingRuleIn('start = $missing', 1, 10);
  });

  it("reports missing rule referenced from a simple and", function() {
    expect(pass).toReportMissingRuleIn('start = &missing', 1, 10);
  });

  it("reports missing rule referenced from a simple not", function() {
    expect(pass).toReportMissingRuleIn('start = !missing', 1, 10);
  });

  it("reports missing rule referenced from an optional", function() {
    expect(pass).toReportMissingRuleIn('start = missing?', 1, 9);
  });

  it("reports missing rule referenced from a zero or more", function() {
    expect(pass).toReportMissingRuleIn('start = missing*', 1, 9);
  });

  it("reports missing rule referenced from a one or more", function() {
    expect(pass).toReportMissingRuleIn('start = missing+', 1, 9);
  });

  describe("reports missing rule referenced from a range", function() {
    it("expression", function() {
      expect(pass).toReportMissingRuleIn('start = missing|2..3|', 1, 9);
    });

    it("delimiter", function() {
      expect(pass).toReportMissingRuleIn('start = "a"|2..3, missing|', 1, 19);
    });
  });
});
