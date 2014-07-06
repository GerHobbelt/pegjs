var visitor      = require("../visitor"),
    arrays       = require("../../utils/arrays"),
    objects      = require("../../utils/objects"),
    asts         = require("../asts"),
    GrammarError = require("../../grammar-error");

/* 
 * Print the ruleset (AST tree) as a diagnostic helper.
 */
module.exports = function(ast, options) {
  var collector = options.collector;
  var startrules = {};
  var activeRule = null;
  var patch;

  // if (!arrays.contains(options.allowedStartRules, node.name)) {
  //   startrules[node.name] = node;
  // }

  function printPre(node, parent, context) {
    console.log("PRE: type = ", node.type, ", depth = ", node.depth, ", parent = ", node.parent, ", PARENT = ", parent, ", context = ", context);
  }

  function printPost(node, parent, returnValue, context) {
    console.log("POST: type = ", node.type, ", depth = ", node.depth, ", parent = ", node.parent, ", PARENT = ", parent, ", context = ", context);
    return returnValue;
  }

  // grammar AST is grammar -> rules[] -> ...
  
  dump = visitor.build({
    __pre__:      printPre,
    __post__:     printPost
  });

  if (0) {
    dump(ast, {
      parent: { 
        name: false 
      },
      depth: 0
    });
  }
};
