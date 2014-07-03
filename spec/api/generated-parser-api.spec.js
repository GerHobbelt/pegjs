describe("generated parser API", function() {
  function varyOptimizationOptions(block) {
    function clone(object) {
      var result = {}, key;

      for (key in object) {
        if (object.hasOwnProperty(key)) {
          result[key] = object[key];
        }
      }

      return result;
    }

    var optionsVariants = [
          { cache: false, optimize: "speed" },
          { cache: false, optimize: "size"  },
          { cache: true,  optimize: "speed" },
          { cache: true,  optimize: "size"  },
        ],
        i;

    for (i = 0; i < optionsVariants.length; i++) {
      describe(
        "with options " + jasmine.pp(optionsVariants[i]),
        function() { block(clone(optionsVariants[i])); }
      );
    }
  }

  beforeEach(function() {
    this.addMatchers({
      toParse: function(input) {
        var options  = arguments.length > 2 ? arguments[1] : {},
            expected = arguments[arguments.length - 1],
            result;

        try {
          result = this.actual.parse(input, options);

          this.message = function() {
            return "Expected " + jasmine.pp(input) + " "
                 + "with options " + jasmine.pp(options) + " "
                 + (this.isNot ? "not " : "")
                 + "to parse as " + jasmine.pp(expected) + ", "
                 + "but it parsed as " + jasmine.pp(result) + ".";
          };

          return this.env.equals_(result, expected);
        } catch (e) {
          this.message = function() {
            return "Expected " + jasmine.pp(input) + " "
                 + "with options " + jasmine.pp(options) + " "
                 + "to parse as " + jasmine.pp(expected) + ", "
                 + "but it failed to parse with message "
                 + jasmine.pp(e.message) + ".";
          };

          return false;
        }
      },

      toFailToParse: function(input) {
        var options = arguments.length > 2 ? arguments[1] : {},
            details = arguments.length > 1
                        ? arguments[arguments.length - 1]
                        : undefined,
            result;

        try {
          result = this.actual.parse(input, options);

          this.message = function() {
            return "Expected " + jasmine.pp(input) + " "
                 + "with options " + jasmine.pp(options) + " "
                 + "to fail to parse"
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
              return "Expected " + jasmine.pp(input)
                   + "with options " + jasmine.pp(options) + " "
                   + "to parse, "
                   + "but it failed with message "
                   + jasmine.pp(e.message) + ".";
            };
          } else {
            if (details) {
              for (key in details) {
                if (details.hasOwnProperty(key)) {
                  if (!this.env.equals_(e[key], details[key])) {
                    this.message = function() {
                      return "Expected " + jasmine.pp(input) + " "
                           + "with options " + jasmine.pp(options) + " "
                           + "to fail to parse"
                           + (details ? " with details " + jasmine.pp(details) : "") + ", "
                           + "but " + jasmine.pp(key) + " "
                           + "is " + jasmine.pp(e[key]) + ".";
                    };

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

  describe("parse", function() {
    var grammar = [
      'a = "x" { return "a"; }',
      'b = "x" { return "b"; }',
      'c = "x" { return "c"; }'
    ].join("\n"),
        parser = PEG.buildParser(grammar, { allowedStartRules: ["b", "c"] }),
        parserAll = PEG.buildParser(grammar, { allowedStartRules: "*" });

    it("parses input", function() {
      var parser = PEG.buildParser('start = "a"');

      expect(parser.parse("a")).toBe("a");
    });

    it("throws an exception on syntax error", function() {
      var parser = PEG.buildParser('start = "a"');

      expect(function() { parser.parse("b"); }).toThrow();
    });

    describe("start rule", function() {
      describe("when |startRule| is not set", function() {
        it("starts parsing from the first allowed rule", function() {
          expect(parser).toParse("x", "b");
        });
      });

      describe("when |startRule| is set to an allowed rule", function() {
        it("starts parsing from the specified rule", function() {
          expect(parser).toParse("x", { startRule: "b" }, "b");
          expect(parser).toParse("x", { startRule: "c" }, "c");
        });
      });

      describe("when |startRule| is set to a disallowed start rule", function() {
        it("throws an exception", function() {
          expect(parser).toFailToParse("x", { startRule: "a" }, {
            message: "Can't start parsing from rule \"a\"."
          });
          expect(
            function() { parser.parse("x", { startRule: "a" }); }
          ).toThrow();
        });
      });
    });

    describe("wildcard start rule", function() {
      it("uses any rule", function() {
        expect(parserAll).toParse("x", { startRule: "a" }, "a");
        expect(parserAll).toParse("x", { startRule: "b" }, "b");
        expect(parserAll).toParse("x", { startRule: "c" }, "c");
      });
    });

    it("accepts custom options", function() {
      var parser = PEG.buildParser('start = "a"');

      parser.parse("a", { foo: 42 });
    });
  });
});
