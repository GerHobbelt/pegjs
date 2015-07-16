/* global expect, it, describe, beforeEach */
"use strict";

var PEG = require("../../../../lib/peg.js");

describe("compiler pass |reportDuplicateLabels|", function() {
  var pass = function ( ast ) {
    return PEG.compiler.passes.check.reportDuplicateLabels(ast, { reportDuplicateLabels: true });
  };
  var details = { message:
    'Duplicate label "a" detected for rule "start". ' +
    'To disable this error, simply set the option "reportDuplicateLabels" to "false" or "0".'
  };

  beforeEach(function() {
    this.addMatchers(require("./helpers.js"));
  });

  it("reports duplicate labels", function() {
    expect(pass).toReportError("start = a:'some' a:'thing'", details);
  });

  it("reports duplicate labels inside expressions", function() {
    expect(pass).toReportError("start = (a:'some')* a:'thing'", details);

    expect(pass).toReportError("start = a:'some' / a:'thing'", details);

    expect(pass).toReportError("start = ('some' / a:'other')+ / a:'thing'", details);
  });

  it("allows unique labels", function() {
    expect(pass).not.toReportError("start = a:'some' b:'thing'");
  });

  it("allows identical labels on different rules", function() {
    expect(pass).not.toReportError([
      "start = a:'some' thing",
      "thing = a:'thing'"
    ].join('\n'));
  });
});
