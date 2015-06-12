"use strict";

var arrays       = require("../../utils/arrays"),
    GrammarError = require("../../grammar-error"),
    asts         = require("../asts"),
    visitor      = require("../visitor");

/*
 * Reports left recursion in the grammar, which prevents infinite recursion in
 * the generated parser.
 *
 * Both direct and indirect recursion is detected. The pass also correctly
 * reports cases like this:
 *
 *   start = "a"? start
 *
 * In general, if a rule reference can be reached without consuming any input,
 * it can lead to left recursion.
 */
function reportLeftRecursion(ast, options) {
  var collector = options.collector;
  var check = visitor.build({
    rule: function(node, parent, visitedRules) {
      check(node.expression, node, visitedRules.concat(node.name));
    },

    sequence: function(node, parent, visitedRules) {
      arrays.every(node.elements, function(element) {
        if (element.type === "rule_ref") {
          check(element, node, visitedRules);
        }

        return asts.matchesEmpty(ast, element);
      });
    },

    rule_ref: function(node, parent, visitedRules) {
      if (arrays.contains(visitedRules, node.name)) {
          collector.emitError(
            "Left recursion detected for rule \"" + node.name + "\".",
            node
          );
        } else {
          // As |collector.emitError| isn't obliged to throw an exception,
          // there are no warranties that the rule exists (pass |report-missing-rules|
          // use this function to report problem).
          var rule = asts.findRule(ast, node.name);
          if (rule) {
            check(rule, node, visitedRules);
          }
        }
      }
  });

  check(ast, null, []);
}

module.exports = reportLeftRecursion;
