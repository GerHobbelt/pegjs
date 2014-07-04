var visitor      = require("../visitor"),
    arrays       = require("../../utils/arrays"),
    objects      = require("../../utils/objects"),
    GrammarError = require("../../grammar-error");

/* 
 * - Link AST nodes up in both directions (child -> parent)
 * - assign 'depth' to each AST node
 */
module.exports = function(ast, options) {
  var collector = options.collector;
  var patch;

  function visitNop(node, context) {
    node.depth = context.depth;
    node.parent = context.parent.name;
  }

  function visitExpression(node, context) {
    node.depth = context.depth;
    node.parent = context.parent.name;

    patch(node.expression, {
      parent: node,
      depth: context.depth + 1
    });
  }

  function visitRange(node, context) { 
    node.depth = context.depth;
    node.parent = context.parent.name;

    patch(node.expression, {
      parent: node,
      depth: context.depth + 1
    });

    if (node.delimiter !== null) {
      patch(node.delimiter, {
        parent: node,
        depth: context.depth + 1
      });
    }
  }

  function visitChildren(property) {
    return function(node, context) {
      node.depth = context.depth;
      node.parent = context.parent.name;

      arrays.each(node[property], function(child) {
        patch(child, {
          parent: node,
          depth: context.depth + 1
        });
      });
    };
  }


  // grammar AST is grammar -> rules[] -> ...
  
  patch = visitor.build({
    grammar: function(node, context) {
      node.depth = context.depth;
      node.parent = context.parent.name;

      if (node.initializer) {
        patch(node.initializer, {
          parent: node,
          depth: context.depth + 1
        });
      }

      arrays.each(node.rules, function (r) {
        patch(r, {
          parent: node,
          depth: context.depth + 1
        });
      });
    },

    rule:         visitExpression,
    named:        visitExpression,
    choice:       visitChildren("alternatives"),
    action:       visitExpression,
    sequence:     visitChildren("elements"),
    labeled:      visitExpression,
    text:         visitExpression,
    simple_and:   visitExpression,
    simple_not:   visitExpression,
    optional:     visitExpression,
    zero_or_more: visitExpression,
    one_or_more:  visitExpression,
    range:        visitRange,

    initializer:  visitNop,
    semantic_and: visitNop,
    semantic_not: visitNop,
    rule_ref:     visitNop,
    literal:      visitNop,
    "class":      visitNop,
    regex:        visitNop,
    code:         visitNop,
    any:          visitNop
  });

  patch(ast, {
    parent: { 
      name: false 
    },
    depth: 0
  });
};
