var visitor      = require("../visitor"),
    GrammarError = require("../../grammar-error");

/* Checks that all rules are defined only once. */
module.exports = function(ast, options) {
  var collector = options.collector;
  var ruleSet = {};

  function checkRule(node) { 
    if (ruleSet[node.name]) {
      var region = ruleSet[node.name].region;
      var str = "";
      if (region && region.begin) {
        str = " (First definition is at line " + region.begin.line + ", column " + region.begin.column + ".)";
      }
      region = node.region;
      if (region && region.begin) {
        str += " (Duplicate definition is at line " + region.begin.line + ", column " + region.begin.column + ".)";
      }
      collector.emitError(
        "Rule \"" + node.name + "\" is defined at least twice." + str,
        node.region
      );
    } else {
      ruleSet[node.name] = node;
    } 
  }

  // grammar AST is grammar -> rules[] -> ...
  
  var check = visitor.build({
    rule:         checkRule
  });

  check(ast);
};
