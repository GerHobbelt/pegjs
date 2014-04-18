describe("compiler pass |reportRedefinedRules|", function() {
  var pass = PEG.compiler.passes.check.reportRedefinedRules;
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
      throw construct(PEG.GrammarError, arguments);
    }
  };

  beforeEach(function() {
    this.addMatchers({
      toReportRedefinedRuleIn: function(grammar, line, column, line2, column2) {
        try {
          var ast = PEG.parser.parse(grammar);

          this.actual(ast, {collector: collector});

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

          return e.message === 'Line '+line+', column '+column+': Rule "redefined" redefined; previously defined in line '+line2+', column '+column2+'.';
        }
      }
    });
  });

  it("reports redefined rule", function() {
    expect(pass).toReportRedefinedRuleIn('start = redefined\nredefined = "a";\nredefined="b"', 3, 1, 2, 1);
  });

});
