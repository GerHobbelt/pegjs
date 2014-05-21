var arrays       = require("../../utils/arrays"),
    GrammarError = require("../../grammar-error"),
    asts         = require("../asts"),
    visitor      = require("../visitor");

/* Checks that all referenced rules exist. */
function reportMissingRules(ast, options) {
  var collector = options.collector;
  function nop() {}

  function checkExpression(node) { check(node.expression); }
  function checkRange(node) { check(node.expression); if (node.delimiter) check(node.delimiter); }

  function checkSubnodes(propertyName) {
    return function(node) { arrays.each(node[propertyName], check); };
  }

  var check = visitor.build({
    grammar:      checkSubnodes("rules"),
    rule:         checkExpression,
    named:        checkExpression,
    choice:       checkSubnodes("alternatives"),
    action:       checkExpression,
    sequence:     checkSubnodes("elements"),
    labeled:      checkExpression,
    text:         checkExpression,
    simple_and:   checkExpression,
    simple_not:   checkExpression,
    semantic_and: nop,
    semantic_not: nop,
    optional:     checkExpression,
    zero_or_more: checkExpression,
    one_or_more:  checkExpression,
    range:        checkRange,

    rule_ref:
      function(node) {
        if (!asts.findRule(ast, node.name)) {
          collector.emitError(
            "Referenced rule \"" + node.name + "\" does not exist.",
            node
          );
        }
      },

    literal:      nop,
    "class":      nop,
    any:          nop
  });

  check(ast);
}

module.exports = reportMissingRules;
