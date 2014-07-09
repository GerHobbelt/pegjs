var arrays  = require("../../utils/arrays"),
    visitor = require("../visitor");

/* Checks that all rules are referenced by another. */
module.exports = function(ast, options) {
  var collector = options.collector;

  var used = {};
  arrays.each(ast.rules, function (r) {
    if (r.isStarterRule) {
      used[r.name] = true;
    }
  });

  var check = visitor.build({
    rule_ref:     function(node, parent) { 
      used[node.name] = true; 
    }
  });

  check(ast);

  var indices = [];

  arrays.each(ast.rules, function(rule, i) {
    if (!used[rule.name]) {
      indices.push(i);
      collector.emitWarning(
        "Rule \"" + rule.name + "\" is not used. (It will be discarded.)",
        rule
      );
    }
  });

  indices.reverse();

  arrays.each(indices, function(i) { 
    ast.rules.splice(i, 1); 
  });
};
