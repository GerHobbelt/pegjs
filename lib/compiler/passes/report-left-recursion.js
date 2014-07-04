var arrays       = require("../../utils/arrays"),
    GrammarError = require("../../grammar-error"),
    asts         = require("../asts"),
    visitor      = require("../visitor");

/* Checks that no left recursion is present. */
function reportLeftRecursion(ast, options) {
  var collector = options.collector;
  var check = visitor.build({
    rule: 
      function(node, appliedRules) {
        check(node.expression, appliedRules.concat(node.name));
      },

    sequence: 
      function(node, appliedRules) {
        check(node.elements[0], appliedRules);
      },

    rule_ref: 
      function(node, appliedRules) {
        if (arrays.contains(appliedRules, node.name)) {
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
            check(rule, appliedRules);
          }
        }
      }
  });

  check(ast, []);
}

module.exports = reportLeftRecursion;
