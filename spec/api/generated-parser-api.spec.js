/* global expect, it, PEG, describe, spyOn */
"use strict";

describe("generated parser API", function() {
  beforeEach(function() {
    this.addMatchers(require("./helpers.js"));
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

    describe("tracing", function() {
      var parser = PEG.buildParser([
            'start = a / b',
            'a = "a"',
            'b = "b"'
          ].join("\n"), { trace: true });

      describe("default tracer", function() {
        it("traces using console.log", function() {
          spyOn(console, "log");

          parser.parse("b");

          expect(console.log).toHaveBeenCalledWith("1:1-1:1 rule.enter start");
          expect(console.log).toHaveBeenCalledWith("1:1-1:1 rule.enter   a");
          expect(console.log).toHaveBeenCalledWith("1:1-1:1 rule.fail    a");
          expect(console.log).toHaveBeenCalledWith("1:1-1:1 rule.enter   b");
          expect(console.log).toHaveBeenCalledWith("1:1-1:2 rule.match   b");
          expect(console.log).toHaveBeenCalledWith("1:1-1:2 rule.match start");
        });
      });

      describe("custom tracers", function() {
        describe("trace", function() {
          it("receives tracing events", function() {
            var tracer = { trace: function() { } };

            spyOn(tracer, "trace");

            parser.parse("b", { tracer: tracer });

            expect(tracer.trace).toHaveBeenCalledWith({
              type:     'rule.enter',
              rule:     'start',
              location: {
                start: { offset: 0, line: 1, column: 1 },
                end:   { offset: 0, line: 1, column: 1 }
              }
            });
            expect(tracer.trace).toHaveBeenCalledWith({
              type:     'rule.enter',
              rule:     'a',
              location: {
                start: { offset: 0, line: 1, column: 1 },
                end:   { offset: 0, line: 1, column: 1 }
              }
            });
            expect(tracer.trace).toHaveBeenCalledWith({
              type:     'rule.fail',
              rule:     'a',
              location: {
                start: { offset: 0, line: 1, column: 1 },
                end:   { offset: 0, line: 1, column: 1 }
              }
            });
            expect(tracer.trace).toHaveBeenCalledWith({
              type:     'rule.enter',
              rule:     'b',
              location: {
                start: { offset: 0, line: 1, column: 1 },
                end:   { offset: 0, line: 1, column: 1 }
              }
            });
            expect(tracer.trace).toHaveBeenCalledWith({
              type:     'rule.match',
              rule:     'b',
              result:   'b',
              location: {
                start: { offset: 0, line: 1, column: 1 },
                end:   { offset: 1, line: 1, column: 2 }
              }
            });
            expect(tracer.trace).toHaveBeenCalledWith({
              type:     'rule.match',
              rule:     'start',
              result:   'b',
              location: {
                start: { offset: 0, line: 1, column: 1 },
                end:   { offset: 1, line: 1, column: 2 }
              }
            });
          });
        });
      });
    });

    it("accepts custom options", function() {
      var parser = PEG.buildParser('start = "a"');

      parser.parse("a", { foo: 42 });
    });
  });
});
