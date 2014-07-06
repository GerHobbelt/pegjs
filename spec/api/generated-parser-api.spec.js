describe("generated parser API", function() {
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
