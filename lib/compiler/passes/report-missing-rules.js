"use strict";

var asts         = require("../asts"),
    visitor      = require("../visitor");

/* Checks that all referenced rules exist. */
function reportMissingRules(ast, options) {
  var collector = options.collector;
  var check = visitor.build({
  rule_ref: 
    function(node, parent) {
      if (!asts.findRule(ast, node.name)) {
        collector.emitError(
          "Referenced rule \"" + node.name + "\" does not exist.",
          node
        );
      }
    }
  });

  check(ast);
}

module.exports = reportMissingRules;
