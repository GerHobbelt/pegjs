var visitor      = require("../visitor"),
    arrays       = require("../../utils/arrays"),
    objects      = require("../../utils/objects"),
    asts         = require("../asts"),
    GrammarError = require("../../grammar-error");

/* 
 * - Link AST nodes up in both directions (child -> parent)
 * - assign 'depth' to each AST node
 * - collect the set of invokers for each rule
 */
module.exports = function(ast, options) {
  var collector = options.collector;
  var rules = {};
  var startrules = {};
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

    if (!arrays.contains(options.allowedStartRules, node.name)) {
      startrules[node.name] = node;
    }

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

  // ---
  // Now set the invokers for each rule (these have been collected in the traversal above)

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

  // ---
  // This third traversal is used to calculate the FIRST/BITES sets for each rule / alternative
  // and calculate the number of characters consumed by each rule / alternative.

  var alternatives = [];          // we need to number all alternatives out there, just like we have done for the rules.

  // As we will use these alternatives' indexes for the memoizing cache too, we start numbering one beyond the rules:
  alternatives.length = ast.rules.length;

  function mixFirstSets(dst, src) {
    if (!src) { return; }

    var fs = src.firstSet;
    if (!fs) { return; }
    if (!dst.firstSet) {
      dst.firstSet = src.firstSet;
    } else {
      var fd = dst.firstSet;
      for (var key in fs) {
        if (fd[key]) {
          fd[key].concat(fs[key]);
        } else {
          fd[key] = fs[key];
        }
      } 
    }
  }

  function calcPre(node) { }

  function calcPost(node, retval) { 
    return retval;
  }

  function calcExpression(node) {
    node.consumption = patch(node.expression);
    return node.consumption;
  }

  function calcRange(node) { 
    var rv = patch(node.expression);
    var delim = {
      min: 0,
      max: 0,
      firstSet: false
    };

    if (node.delimiter !== null) {
      delim = patch(node.delimiter);
    }

    rv.min *= node.min;
    if (node.max === +node.max && isFinite(node.max)) {
      rv.max *= node.max;
    } else {
      rv.max = Infinity;
    }
    // when the range dictates that at least 2 occurrences are required, 
    // with delimiter included, the size of the delimiter matters too:
    if (node.min >= 2) {
      if (rv.min === 0) {
        // if the expression itself does not consume anything, 
        // then the delimiter is part of the FIRST/BITES set too!
        mixFirstSets(rv, delim);
      }
      rv.min += (node.min - 1) * delim.min;
    }

    node.consumption = rv;
    return node.consumption;
  }

  function calcChoice(node) {
    var rv = false;

    arrays.each(node.alternatives, function(alternative) {
      var alternativeIndex = alternative.index = alternatives.length;
      alternatives[alternativeIndex] = alternative;

      var av = patch(alternative);
      if (!rv) {
        rv = av;
      } else {
        // each alternative adds to the FIRST/BITES set too!
        mixFirstSets(rv, av);
        
        rv.min = Math.min(rv.min, av.min);
        rv.max = Math.max(rv.max, av.max);
      }
    });

    node.consumption = rv;
    return node.consumption;
  }

  function calcSequence(node) {
    var rv = false;

    arrays.each(node.elements, function(element) {
      var sv = patch(element);
      if (!rv) {
        rv = sv;
      } else {
        if (rv.min === 0) {
          // if the expression did not consume anything yet, 
          // then this element is part of the FIRST/BITES set too!
          mixFirstSets(rv, sv);
        }

        rv.min += sv.min;
        rv.max += sv.max;
      }
    });

    node.consumption = rv;
    return node.consumption;
  }


  function calcSemanticAnd(node) {
    // As we cannot predict what the code chunk will do, we have to assume the worst: anything goes.
    node.code.consumption = {
      min: 0,
      max: Infinity,
      firstSet: {
        all: [node]
      }
    };

    // As this is a predicate, we don't consume any input, ever!
    node.consumption = {
      min: 0,
      max: 0,
      firstSet: {
        all: [node]
      }
    };
    return node.consumption;
  }

  function calcSemanticNot(node) {
    // As we cannot predict what the code chunk will do, we have to assume the worst: anything goes.
    node.code.consumption = {
      min: 0,
      max: Infinity,
      firstSet: {
        all: [node]
      }
    };

    // As this is a predicate, we don't consume any input, ever!
    node.consumption = {
      min: 0,
      max: 0,
      firstSet: {
        all: [node]
      }
    };
    return node.consumption;
  }

  function calcRuleRef(node) {
    var rule = asts.findRule(ast, node.name);
    node.consumption = patch(rule);
    return node.consumption;
  }

  function calcLiteral(node) {
    node.consumption = {
      min: node.value.length,
      max: node.value.length,
      firstSet: {
        literal: [node] 
      }
    }; 
    return node.consumption;
  }

  function calcClass(node) {
    node.consumption = {
      min: 1,
      max: 1,
      firstSet: {
        charset: [node] 
      }
    }; 
    return node.consumption;
  }

  function calcRegex(node) {
    node.consumption = {
      min: 0,
      max: Infinity,
      firstSet: {
        regex: [node] 
      }
    }; 
    return node.consumption;
  }

  function calcCode(node) {
    node.consumption = {
      min: 0,
      max: Infinity,
      firstSet: {
        code: [node] 
      }
    }; 
    return node.consumption;
  }

  function calcAny(node) {
    node.consumption = {
      min: 1,
      max: 1,
      firstSet: {
        any: [node] 
      }
    }; 
    return node.consumption;
  }

  function calcRule(node) {
    // as we expect cycles, we flag the info as 'fail' before we start,
    // then the tree traversal will, when a rule_ref hits upon this entry, see this signal
    // and traverse accordingly.
    if (node.consumption == null) {
      node.consumption = false;
    }
    else if (node.consumption) {
      // this rule's consumption pattern may already have been calculated as part of another rule's, 
      // so we don't need to do that bit of work any more:
      return node.consumption;
    }
    else if (node.consumption === false) {
      // Bang! We've run into a cycle! To prevent an infinite loop, 
      // we send the receiver a faked preliminary result which would mimic
      // the Medeiros[2014] (left-)recursion solution where the round 0 would 
      // produce 'fail' and hence not consume any input at all:
      return {
        min: 0,
        max: 0,
        firstSet: {
          rule: [node]
        }
      }; 
    }

    return calcExpression(node);
  }

  function calcNamed(node) {
    return calcExpression(node);
  }

  function calcAction(node) {
    return calcExpression(node);
  }

  function calcLabeled(node) {
    return calcExpression(node);
  }

  function calcText(node) {
    return calcExpression(node);
  }

  function calcSimpleAnd(node) {
    var rv = calcExpression(node);

    // As this is a predicate, it will never consume any input!
    node.consumption = {
      min: 0,
      max: 0,
      firstSet: rv.firstSet
    };
    return node.consumption;
  }

  function calcSimpleNot(node) {
    var rv = calcExpression(node);

    // As this is a predicate, it will never consume any input!
    node.consumption = {
      min: 0,
      max: 0,
      firstSet: rv.firstSet
    };
    return node.consumption;
  }

  function calcOptional(node) {
    var rv = calcExpression(node);

    node.consumption = {
      min: 0,
      max: rv.max,
      firstSet: rv.firstSet
    };
    return node.consumption;
  }

  function calcZeroOrMore(node) {
    var rv = calcExpression(node);

    node.consumption = {
      min: 0,
      max: (rv.max !== 0 ? Infinity : 0),
      firstSet: rv.firstSet
    };
    return node.consumption;
  }

  function calcOneOrMore(node) {
    var rv = calcExpression(node);

    node.consumption = {
      min: rv.min,
      max: (rv.max !== 0 ? Infinity : 0),
      firstSet: rv.firstSet
    };
    return node.consumption;
  }

  function calcAnnotation(node) {
  }


  patch = visitor.build({
    annotation:   calcAnnotation,
    rule:         calcRule,
    named:        calcNamed,
    choice:       calcChoice,
    action:       calcAction,
    sequence:     calcSequence,
    labeled:      calcLabeled,
    text:         calcText,
    simple_and:   calcSimpleAnd,
    simple_not:   calcSimpleNot,
    optional:     calcOptional,
    zero_or_more: calcZeroOrMore,
    one_or_more:  calcOneOrMore,
    range:        calcRange,
    semantic_and: calcSemanticAnd,
    semantic_not: calcSemanticNot,
    rule_ref:     calcRuleRef,
    literal:      calcLiteral,
    "class":      calcClass,
    regex:        calcRegex,
    code:         calcCode,
    any:          calcAny,

    __pre__:      calcPre,
    __post__:     calcPost
  });

  patch(ast);

};
