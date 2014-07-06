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
    console.log("PRE: type = ", node.type, ", name = ", node.name, ", depth = ", node.depth, ", parent = ", node.parent, ", PARENT = ", parent, ", context = ", context);
  }

  function printPost(node, parent, returnValue, context) {
    console.log("POST: type = ", node.type, ", name = ", node.name, ", depth = ", node.depth, ", parent = ", node.parent, ", PARENT = ", parent, ", context = ", context);
    return returnValue;
  }

  function printAnnotationPre(annotation, parent_annotation, node, parent, context) { 
    console.log("ANNO PRE: type = ", annotation.type, ", name = ", annotation.name, ", parent_anno = ", parent_annotation, ", type = ", node.type, ", depth = ", node.depth, ", parent = ", node.parent, ", PARENT = ", parent, ", context = ", context);
  }

  function printAnnotationPost(annotation, parent_annotation, node, parent, returnValue, context) { 
    console.log("ANNO POST: type = ", annotation.type, ", name = ", annotation.name, ", parent_anno = ", parent_annotation, ", type = ", node.type, ", depth = ", node.depth, ", parent = ", node.parent, ", PARENT = ", parent, ", context = ", context);
    return returnValue;
  }


  // grammar AST is grammar -> rules[] -> ...
  
  dump = visitor.build({
    __pre__:      printPre,
    __post__:     printPost,
    
    __annotation_pre__:  printAnnotationPre,
    __annotation_post__: printAnnotationPost
  });

  console.log("=== DIAGNOSTIC DUMP ===\n");
  if (0) {
    dump(ast, null, { blubber: 42 });
  }
};
