/* global describe, PEG, it, expect */
"use strict";

var GrammarError = require("../../../../lib/grammar-error");

// TODO: write a proper spec for this one!

describe("compiler pass |reportUnusedRules|", function() {
  var pass = PEG.compiler.passes.check.reportUnusedRules;
  var collector = {
    emitFatalError: function(message, extra_info) {
      throw new GrammarError(message, extra_info);
    },
    emitError: function(message, extra_info) {
      throw new GrammarError(message, extra_info);
    },
    emitWarning: function(message, extra_info) {
      throw new GrammarError(message, extra_info);
    },
    emitInfo: function(message, extra_info) {
      throw new GrammarError(message, extra_info);
    }
  };

  beforeEach(function() {
    this.addMatchers({
      toReportUnusedRuleIn: function(grammar, line, column) {
        try {
          var ast = PEG.parser.parse(grammar);

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

          return e.message === 'Line '+line+', column '+column+': Rule "start" is not used.';
        }
      }
    });
  });

  it("reports unused rule referenced from a rule", function() {
    expect(pass).toReportUnusedRuleIn('start = unused', 1, 1);
  });

  it("reports unused rule referenced from a named", function() {
    expect(pass).toReportUnusedRuleIn('start "start" = unused', 1, 1);
  });

  it("reports unused rule referenced from a choice", function() {
    expect(pass).toReportUnusedRuleIn('start = unused / "a" / "b"', 1, 1);
    expect(pass).toReportUnusedRuleIn('start = "a" / "b" / unused', 1, 1);
  });

  it("reports unused rule referenced from an action", function() {
    expect(pass).toReportUnusedRuleIn('start = unused { }', 1, 1);
  });

  it("reports unused rule referenced from a sequence", function() {
    expect(pass).toReportUnusedRuleIn('start = unused "a" "b"', 1, 1);
    expect(pass).toReportUnusedRuleIn('start = "a" "b" unused', 1, 1);
  });

  it("reports unused rule referenced from a labeled", function() {
    expect(pass).toReportUnusedRuleIn('start = label:unused', 1, 1);
  });

  it("reports unused rule referenced from a text", function() {
    expect(pass).toReportUnusedRuleIn('start = $unused', 1, 1);
  });

  it("reports unused rule referenced from a simple and", function() {
    expect(pass).toReportUnusedRuleIn('start = &unused', 1, 1);
  });

  it("reports unused rule referenced from a simple not", function() {
    expect(pass).toReportUnusedRuleIn('start = !unused', 1, 1);
  });

  it("reports unused rule referenced from an optional", function() {
    expect(pass).toReportUnusedRuleIn('start = unused?', 1, 1);
  });

  it("reports unused rule referenced from a zero or more", function() {
    expect(pass).toReportUnusedRuleIn('start = unused*', 1, 1);
  });

  it("reports unused rule referenced from a one or more", function() {
    expect(pass).toReportUnusedRuleIn('start = unused+', 1, 1);
  });

  describe("reports unused rule referenced from a range", function() {
    it("expression", function() {
      expect(pass).toReportUnusedRuleIn('start = unused|2..3|', 1, 1);
    });

    it("delimiter", function() {
      expect(pass).toReportUnusedRuleIn('start = "a"|2..3, unused|', 1, 1);
    });
  });
});
