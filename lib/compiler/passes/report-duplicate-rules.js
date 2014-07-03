var arrays       = require("../../utils/arrays"),
    GrammarError = require("../../grammar-error");

/* Checks that all rules are defined only once. */
module.exports = function(ast) {
  var ruleSet = {};

  function checkRule(node) { 
    if (ruleSet[node.name]) {
      var region = ruleSet[node.name].region;
      var str = "";
      if (region) {
        str = " (First definition is at line " + region.begin.line + ", column " + region.begin.column + ".)";
      }
      throw new GrammarError(
        "Rule \"" + node.name + "\" is defined at least twice." + str,
        node.region
      );
    } else {
      ruleSet[node.name] = node;
    } 
  }

  function checkSubnodes(propertyName) {
    return function(node) { 
      arrays.each(node[propertyName], check); 
    };
  }

  // grammar AST is grammar -> rules[] -> ...
  
  var check = arrays.buildNodeVisitor({
    grammar:      checkSubnodes("rules"),
    rule:         checkRule
  });

  check(ast);
};
