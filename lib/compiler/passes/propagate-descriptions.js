var visitor      = require("../visitor"),
    GrammarError = require("../../grammar-error");

/* Checks that all rules are defined only once. */
module.exports = function(ast, options) {
  var collector = options.collector;

  // grammar AST is grammar -> rules[] -> ...
  
  var check = visitor.build({
    rule: function(node) {
      // propagate the name down to the child node, when it's all alone in the expression:
      var xpr = node; // start at the node itself: modify it and its children
      while (xpr) {
        //if (options.verboseOutput) console.log("propagate rule name to child: ", node.name, xpr.type);
        if (xpr.type === 'named') { break; }
        if (xpr.description && xpr.description.depth >= node.depth) { break; }
        xpr.description = {
          text: node.name,
          depth: node.depth
        };
        xpr = xpr.expression;
      }

      check(node.expression);
    },

    named: function(node) {
      // propagate the name down to the child node, when it's all alone in the expression:
      var xpr = node; // start at the node itself: modify it and its children
      while (xpr) {
        //if (options.verboseOutput) console.log("propagate named name to child: ", node.name, xpr.type);
        if (xpr.description && xpr.description.depth >= node.depth) { break; }
        xpr.description = {
          text: node.name,
          depth: node.depth
        };
        xpr = xpr.expression;
      }

      check(node.expression);
    },

    labeled: function(node) {
      if (node.label == null) { return; }
      
      // propagate the label down to the child node, when it's all alone in the expression:
      var xpr = node; // start at the node itself: modify it and its children
      while (xpr) {
        //if (options.verboseOutput) console.log("propagate label to child: ", node.label, xpr.type);
        if (xpr.description && xpr.description.depth >= node.depth) { break; }
        xpr.description = {
          text: node.label,
          depth: node.depth
        };
        xpr = xpr.expression;
      }

      check(node.expression);
    }
  });

  check(ast);
};
