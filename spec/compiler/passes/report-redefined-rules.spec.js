describe("compiler pass |reportRedefinedRules|", function() {
  var pass = PEG.compiler.passes.check.reportRedefinedRules;

  beforeEach(function() {
    this.addMatchers({
      toReportRedefinedRuleIn: function(grammar, line, column, line2, column2) {
        var ast = PEG.parser.parse(grammar);

        try {
          this.actual(ast);

          this.message = function() {
            return "Expected the pass to report a redefined rule for grammar "
                 + jasmine.pp(grammar) + ", "
                 + "but it didn't.";
          };

          return false;
        } catch (e) {
          if (this.isNot) {
            this.message = function() {
              return "Expected the pass not to report a redefined rule for grammar "
                   + jasmine.pp(grammar) + ", "
                   + "but it did.";
            };
          } else {
            this.message = function() {
              return "Expected the pass to report a redefined rule for grammar "
                   + jasmine.pp(grammar) + ", "
                   + "but it reported an error with message "
                   + jasmine.pp(e.message) + ".";
            };
          }

          return e.message === 'Line '+line+', column '+column+': Rule "redefined" is defined at least twice. (First definition is at line '+line2+', column '+column2+'.)';
        }
      }
    });
  });

  it("reports redefined rule", function() {
    expect(pass).toReportRedefinedRuleIn('start = redefined\nredefined = "a";\nredefined="b"', 3, 1, 2, 1);
  });

});
