describe("compiler pass |reportLeftRecursion|", function() {
  var pass = PEG.compiler.passes.check.reportLeftRecursion;
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
      //throw construct(PEG.GrammarError, arguments);
    },
    emitInfo: function() {
      //throw construct(PEG.GrammarError, arguments);
    }
  };

  beforeEach(function() {
    this.addMatchers({
      toReportLeftRecursionIn: function(grammar, line, column) {
        var ast = PEG.parser.parse(grammar);

        try {
          this.actual(ast, {collector: collector});

          this.message = function() {
            return "Expected the pass to report left recursion for grammar "
                 + jasmine.pp(grammar) + ", "
                 + "but it didn't.";
          };

          return false;
        } catch (e) {
          if (this.isNot) {
            this.message = function() {
              return "Expected the pass not to report left recursion for grammar "
                   + jasmine.pp(grammar) + ", "
                   + "but it did.";
            };
          } else {
            this.message = function() {
              return "Expected the pass to report left recursion for grammar "
                   + jasmine.pp(grammar) + ", "
                   + "but it reported an error with message "
                   + jasmine.pp(e.message) + ".";
            };
          }

          return e.message === 'Line '+line+', column '+column+': Left recursion detected for rule \"start\".';
        }
      }
    });
  });

  it("reports left recursion inside a rule", function() {
    expect(pass).toReportLeftRecursionIn('start = start', 1, 9);
  });

  it("reports left recursion inside a named", function() {
    expect(pass).toReportLeftRecursionIn('start "start" = start', 1, 17);
  });

  it("reports left recursion inside a choice", function() {
    expect(pass).toReportLeftRecursionIn('start = start / "a" / "b"', 1, 9);
    expect(pass).toReportLeftRecursionIn('start = "a" / "b" / start', 1, 21);
  });

  it("reports left recursion inside an action", function() {
    expect(pass).toReportLeftRecursionIn('start = start { }', 1, 9);
  });

  it("reports left recursion inside a sequence", function() {
    expect(pass).toReportLeftRecursionIn('start = start "a" "b"', 1, 9);
  });

  it("reports left recursion inside a labeled", function() {
    expect(pass).toReportLeftRecursionIn('start = label:start', 1, 15);
  });

  it("reports left recursion inside a text", function() {
    expect(pass).toReportLeftRecursionIn('start = $start', 1, 10);
  });

  it("reports left recursion inside a simple and", function() {
    expect(pass).toReportLeftRecursionIn('start = &start', 1, 10);
  });

  it("reports left recursion inside a simple not", function() {
    expect(pass).toReportLeftRecursionIn('start = !start', 1, 10);
  });

  it("reports left recursion inside an optional", function() {
    expect(pass).toReportLeftRecursionIn('start = start?', 1, 9);
  });

  it("reports left recursion inside a zero or more", function() {
    expect(pass).toReportLeftRecursionIn('start = start*', 1, 9);
  });

  it("reports left recursion inside a one or more", function() {
    expect(pass).toReportLeftRecursionIn('start = start+', 1, 9);
  });

  it("reports left recursion inside a range expression", function() {
    expect(pass).toReportLeftRecursionIn('start = start|2..3|');
    expect(pass).toReportLeftRecursionIn('start = start|2..3, "a"|');
    expect(pass).toReportLeftRecursionIn('start = start|2|');
    expect(pass).toReportLeftRecursionIn('start = start|2, "a"|');
  });

  it("not reports left recursion inside a range delimiter", function() {
    expect(pass).not.toReportLeftRecursionIn('start = "a"|2..3, start|');
    expect(pass).not.toReportLeftRecursionIn('start = "a"|2, start|');
  });

  it("reports indirect left recursion", function() {
    expect(pass).toReportLeftRecursionIn([
      'start = stop',
      'stop  = start'
    ].join("\n"), 2, 9);
  });
});
