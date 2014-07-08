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

  var pre_handlers = {
  };

  var post_handlers = {
  };

  function visitPre(node, parent, context) {
    var f = pre_handlers[node.type];
    if (f) {
      f.apply(this, arguments);
    }
  }

  function visitAnnotationPre(annotation, parent_annotation, node, parent, context) { 
    var f = pre_handlers[node.type];
    if (f) {
      f.apply(this, arguments);
    }
  }

  function visitPost(node, parent, returnValue, context) {
    var f = post_handlers[node.type];
    if (f) {
      returnValue = f.apply(this, arguments);
    }
    return returnValue;
  }

  function visitAnnotationPre(annotation, parent_annotation, node, parent, returnValue, context) { 
    var f = post_handlers[node.type];
    if (f) {
      returnValue = f.apply(this, arguments);
    }
    return returnValue;
  }

  function isStartRule(rule) {
    return arrays.contains(options.allowedStartRules, rule.name);
  }



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
  
  dump = visitor.build({
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
