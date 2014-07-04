var visitor      = require("../visitor"),
    arrays       = require("../../utils/arrays"),
    objects      = require("../../utils/objects"),
    GrammarError = require("../../grammar-error");

/* 
 * - Link AST nodes up in both directions (child -> parent)
 * - assign 'depth' to each AST node
 * - collect the set of invokers for each rule (where "*start*" designates the rule to be one of the start rules)
 */
module.exports = function(ast, options) {
  var collector = options.collector;
  var rules = {};
  var invokers = {};
  var activeRule = null;
  var patch;

  function visitNop(node, context) {
    node.depth = context.depth;
    node.parent = context.parent.name;
  }

  function visitRuleRef(node, context) {
    if (!invokers[node.name]) {
      invokers[node.name] = {};
    }
    invokers[node.name][activeRule.name] = node;

    visitNop(node, context);
  }

  function visitRuleDefinition(node, context) {
    rules[node.name] = node;
    if (!invokers[node.name]) {
      invokers[node.name] = {};
    }

    activeRule = node;

    visitExpression(node, context);
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

    rule:         visitRuleDefinition,
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
    rule_ref:     visitRuleRef,
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


  function visitSetRuleInvokers(node) {
    var list = [];
    for (var name in invokers[node.name]) {
      if (invokers.hasOwnProperty(name)) {
        list.push(name);
      }
    }
    node.invokers = list;
  }

  patch = visitor.build({
    rule:         visitSetRuleInvokers
  });

  patch(ast);
};
