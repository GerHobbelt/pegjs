/* global describe, expect, it, beforeEach */

"use strict";

var PEG = require("../../../../lib/peg.js");

describe("compiler pass |reportMissingRules|", function() {
  var pass = PEG.compiler.passes.check.reportMissingRules;

  beforeEach(function() {
    this.addMatchers(require("./helpers.js"));
  });

  it("reports missing rules", function() {
    expect(pass).toReportError('start = missing', {
      message:  'Referenced rule "missing" does not exist.',
      location: {
        start: { offset:  8, line: 1, column:  9 },
        end:   { offset: 15, line: 1, column: 16 }
      }
    });
  });
});
