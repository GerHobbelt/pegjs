/* global expect, it, describe, beforeEach */
"use strict";

var PEG = require("../../../../lib/peg.js");

describe("compiler pass |reportDuplicateRules|", function() {
  var pass = function ( ast ) {
    return PEG.compiler.passes.check.reportDuplicateRules(ast, { reportDuplicateRules: true });
  };
  var details = { message:
    'Duplicate rule "start" detected in grammer. ' +
    'To disable this error, simply set the option "reportDuplicateRules" to "false" or "0".'
  };

  beforeEach(function() {
    this.addMatchers(require("./helpers.js"));
  });

  it("reports duplicate rules", function(){
    expect(pass).toReportError([
      "start = 'a'",
      "start = 'a'"
    ].join('\n'), details);
  });
});
