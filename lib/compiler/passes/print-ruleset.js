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

  function printPre(node, parent, context) {
    console.log("PRE: type = ", node.type, ", name = ", (node.name || ("#" + node.type)), ", depth = ", node.depth, ", parent = ", (node.parent ? (node.parent.name || ("#" + node.parent.type)) : "---"), ", PARENT = ", (parent ? (parent.name || ("#" + parent.type)) : "---"), ", context = ", context);
  }

  function printPost(node, parent, returnValue, context) {
    return returnValue;
  }

  function printAnnotationPre(annotation, parent_annotation, node, parent, context) { 
    console.log("ANNO PRE: type = ", annotation.type, ", name = ", (annotation.name || ("#" + annotation.type)), ", parent_anno = ", parent_annotation, ", type = ", node.type, ", depth = ", node.depth, ", parent = ", (node.parent ? node.parent.type : "---"), ", PARENT = ", (parent ? parent.type : "---"), ", context = ", context);
  }

  function printAnnotationPost(annotation, parent_annotation, node, parent, returnValue, context) { 
    return returnValue;
  }


  // grammar AST is grammar -> rules[] -> ...
  
  var dump = visitor.build({
    __pre__:      printPre,
    __post__:     printPost,
    
    __annotation_pre__:  printAnnotationPre,
    __annotation_post__: printAnnotationPost
  });

  if (options.printRuleSet) {
    console.log("=== DIAGNOSTIC DUMP ===\n", options);
    dump(ast, null, { blubber: 42 });
  }
};
