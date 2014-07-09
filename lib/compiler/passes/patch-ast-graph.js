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
  var startrulesCount = 0;
  var startrulesFirst = {
    index: Infinity,
    node: null
  };
  var invokers = {};
  var activeRule = null;
  var patch;

  //
  // # Phase 1
  //
  // Assign a `depth` to every AST node which represents it position in the tree. 
  // This depth is later used, for instance, to determine which propagated description
  // will 'win' at each node.
  //
  // Also collect the set of rules which invoke other rules, i.e. set up the base for
  // turning the AST into a rule 'dependency graph' (by invoker relation).
  //

  var phase1_handlers = {
    rule_ref: phase1_visitRuleRef,
    rule:     phase1_visitRuleDefinition
  };

  function phase1_visitPre(node, parent) {
    node.depth = parent.depth + 1;
    node.parent = parent;
    node.previousSibling = null;
    node.nextSibling = null;
      
    var f = phase1_handlers[node.type];
    if (f) {
      f.apply(this, arguments);
    }
  }

  function phase1_visitRuleRef(node, parent) {
    var rule = rules[node.name];
    if (!rule) {
      rule = asts.findRule(ast, node.name);
      rules[node.name] = rule;
    }
    node.ruleRef = rule;

    if (!invokers[node.name]) {
      invokers[node.name] = {};
    }
    invokers[node.name][activeRule.name] = node;
  }

  function phase1_visitRuleDefinition(node, parent) {
    rules[node.name] = node;

    var idx = arrays.indexOf(options.allowedStartRules, node.name);
    if (idx !== -1) {
      startrulesCount++; 
      startrules[node.name] = node;
      if (idx < startrulesFirst.index) {
        startrulesFirst.index = idx;
        startrulesFirst.node = node;
      }
    }

    if (!invokers[node.name]) {
      invokers[node.name] = {};
    }

    activeRule = node;
  }

  // grammar AST is grammar -> rules[] -> ...
  
  patch = visitor.build({
    __pre__: phase1_visitPre
  });

  patch(ast, {
    depth: -1                   // grammar will end up as the root node at depth = 0 
  });

  // post-check: report which starter rules listed in the options don't exist:
  var unlistedStarters = [];
  arrays.each(options.allowedStartRules, function (r) {
    if (r === "*") { return; }
    if (!startrules[r]) {
      unlistedStarters.push(r);
    }
  });
  if (unlistedStarters.length) {
    collector.emitWarning("These rules specified in the options as starters are not defined in this grammar: " + unlistedStarters.join(", "));
  }

  // post-fix: when no starter rules are specified, the first rule is assumed to start it all:
  if (!startrulesCount) {
    var starter = ast.rules[0];
    startrules[starter.name] = starter;
    startrulesCount++;

    startrulesFirst.index = -1;
    startrulesFirst.node = starter;

    collector.emitWarning("No valid starter rule has been defined. Assuming the first rule (" + starter.name + ") is the only starter.");
  }


  //
  // # Phase 2
  //
  // Set the invokers for each rule (these have been collected in phase 1).
  //
  // Flag rules as 'starting' (isStarterRule) when they are (faster than
  // running a lookup check in the options every time).
  //

  function visitSetRuleInvokers(node, parent) {
    var list = [];
    var invokerSet = invokers[node.name];
    for (var name in invokerSet) {
      if (invokerSet.hasOwnProperty(name)) {
        list.push(name);
      }
    }
    node.invokers = list;
    node.isStarterRule = !!startrules[node.name];
    if (node === startrulesFirst.node) {
      node.isStarterRule = 2;                 // signal that this one is the *default* starter!
    }
  }

  patch = visitor.build({
    rule:         visitSetRuleInvokers
  });

  patch(ast);

  //
  // # Phase 2
  //
  // Calculate the FIRST/BITES sets for each rule / alternative
  // and calculate the number of characters consumed by each rule / alternative.
  //
  // That info is used to determine which rules / alternatives *may* be
  // helped by adding memoization (a la packrat PEG parsers) and which ones
  // are not -- packrat parsers generally apply memoization 'across the board'
  // and this does not improve parser run-time performance, hence we seek
  // to apply this optimization so that we have
  //
  // 1. a better chance of delivering improved performance by memoization, not
  //    just for pathological scenarios (where regular PEG parsers exhibit
  //    exponential behaviour and memoization transforms this into linear).
  //
  // 2. a smaller memoization memory footprint as only the elements which
  //    *probably* benefit from memoization actually participate in the 
  //    packrat scheme.
  //

  var alternatives = [];          // we need to number all alternatives out there, just like we have done for the rules.

  // As we will use these alternatives' indexes for the memoizing cache too, we start numbering one beyond the rules:
  alternatives.length = ast.rules.length;

  function mixFirstSets(dst, src) {
    if (!src) { return; }

    var fs = src.firstSet;
    if (!fs) { return; }
    if (!dst.firstSet) {
      dst.firstSet = {};
    } 
    var fd = dst.firstSet;
    for (var key in fs) {
      fd[key] = arrays.merge(fd[key], fs[key]);
    } 
  }

  var phase3_handlers = {
    grammar:      calcGrammar,
    rule:         calcRulePost,
    choice:       calcChoice,
    sequence:     calcSequence,
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
    epsilon:      calcEpsilon
  };

  function calcPost(node, parent, returnValue) {
    // See also `calcRulePost` and `calcRuleVisitor` comments:
    // when an AST node type has a custom handler, that handler
    // is responsible for setting the `node.consumption` field
    // (or *not* setting it, in case of recursive invocations 
    // of the `rule` handler due to a recursion (cycle) in the
    // grammar definition).   
    var f = phase3_handlers[node.type];
    if (f) {
      return f.apply(this, arguments);
    }
    node.consumption = returnValue;
    return node.consumption;
  }

  function calcGrammar(node, parent, returnValue) {
    var rv = {
      min: 0,
      max: Infinity,
      firstSet: false
    };
    var name, rule, ruleConsumption;

    for (name in startrules) {
      if (startrules.hasOwnProperty(name)) {
        rule = startrules[name];

        ruleConsumption = rule.consumption;
        // each starter adds to the FIRST/BITES set for the entire grammar! A bit moot, but alas...
        mixFirstSets(rv, ruleConsumption);
        
        rv.min = Math.min(rv.min, ruleConsumption.min);
        rv.max = Math.max(rv.max, ruleConsumption.max);
      }
    }

    node.consumption = rv;
    return node.consumption;
  }

  function calcRange(node, parent, returnValue) { 
    var delim = {
      min: 0,
      max: 0,
      firstSet: false
    };

    if (node.delimiter !== null) {
      delim = node.delimiter.consumption;
    }

    returnValue.min *= node.min;
    if (node.max === +node.max && isFinite(node.max)) {
      returnValue.max *= node.max;
    } else {
      returnValue.max = Infinity;
    }
    // when the range dictates that at least 2 occurrences are required, 
    // with delimiter included, the size of the delimiter matters too:
    if (node.min >= 2) {
      if (returnValue.min === 0) {
        // if the expression itself does not consume anything, 
        // then the delimiter is part of the FIRST/BITES set too!
        mixFirstSets(returnValue, delim);
      }
      returnValue.min += (node.min - 1) * delim.min;
    }

    node.consumption = returnValue;
    return node.consumption;
  }

  function calcChoice(node, parent, returnValue) {
    var rv = {
      min: Infinity,
      max: 0,
      firstSet: false
    };

    arrays.each(node.alternatives, function(alt) {
      var alternativeIndex = alt.index = alternatives.length;
      alternatives[alternativeIndex] = alt;

      var av = alt.consumption;
      // each alternative adds to the FIRST/BITES set too!
      mixFirstSets(rv, av);
      
      rv.min = Math.min(rv.min, av.min);
      rv.max = Math.max(rv.max, av.max);
    });

    node.consumption = rv;
    return node.consumption;
  }

  function calcSequence(node, parent, returnValue) {
    var rv = {
      min: 0,
      max: 0,
      firstSet: false
    };

    arrays.each(node.elements, function(element) {
      var sv = element.consumption;
      if (rv.min === 0) {
        // if the expression did not consume anything yet, 
        // then this element is part of the FIRST/BITES set too!
        mixFirstSets(rv, sv);
      }

      rv.min += sv.min;
      rv.max += sv.max;
    });

    node.consumption = rv;
    return node.consumption;
  }


  function calcSemanticAnd(node, parent, returnValue) {
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

  function calcSemanticNot(node, parent, returnValue) {
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

  function calcRuleRef(node, parent, returnValue) {
    var rule = asts.findRule(ast, node.name);

    // We may be a 'forward reference' to the rule, hence we need to invoke the rule and have it calculate 
    // its consumption for us, before we can return.
    //
    // Do note that rule definitions *may* be recursive (they probably are!) hence we need to ensure the resulting
    // recursive tree traversal terminates: we do *not* need to invoke the rule if it has already been 
    // calculated before, for whatever reason (the calculated statistics do not change once calculated).
    node.consumption = patch(rule, node);
    return node.consumption;
  }

  function calcLiteral(node, parent, returnValue) {
    node.consumption = {
      min: node.value.length,
      max: node.value.length,
      firstSet: {
        literal: [node] 
      }
    }; 
    return node.consumption;
  }

  function calcClass(node, parent, returnValue) {
    node.consumption = {
      min: 1,
      max: 1,
      firstSet: {
        charset: [node] 
      }
    }; 
    return node.consumption;
  }

  function calcRegex(node, parent, returnValue) {
    // Of course we could analyze the regex to detect whether it matches 'empty string'
    // but it is easier to just test the bugger; the most important piece of info anyway
    // is knowing whether a node will *at least* consume 1 character of input, or not.
    var re = new Regex(node.value);
    var min = + re.test("");   // min: false -> 0 / true -> 1
    node.consumption = {
      min: min,
      max: Infinity,
      firstSet: {
        regex: [node] 
      }
    }; 
    return node.consumption;
  }

  function calcCode(node, parent, returnValue) {
    // We cannot predict what a custom parser code chunk will do in terms of input consumption,
    // hence we have to assume the worst.
    node.consumption = {
      min: 0,
      max: Infinity,
      firstSet: {
        code: [node] 
      }
    }; 
    return node.consumption;
  }

  function calcAny(node, parent, returnValue) {
    node.consumption = {
      min: 1,
      max: 1,
      firstSet: {
        any: [node] 
      }
    }; 
    return node.consumption;
  }

  function calcEpsilon(node, parent, returnValue) {
    node.consumption = {
      min: 0,
      max: 0,
      firstSet: {
        epsilon: [node] 
      }
    }; 
    return node.consumption;
  }

  function calcRuleVisitor(node, parent) {
    // As we *must* expect cycles, we flag the info as 'fail' before we start,
    // then the tree traversal will, when a rule_ref hits upon this entry, 
    // make us see this signal and we can act accordingly.
    if (node.consumption == null) {
      node.consumption = false;
    }
    else if (node.consumption) {
      // This rule's consumption pattern may already have been calculated as part of another rule's
      // or due to a direct or indirect recursive cycle in this rule itself, 
      // so we don't need to do that bit of work any more:
      return node.consumption;
    }
    else if (node.consumption === false) {
      // Bang! We've run into a cycle! To prevent an infinite loop, 
      // we send the receiver a faked preliminary result which would mimic
      // the Medeiros[2014] (left-)recursion solution where the round 0 would 
      // produce 'fail' and hence not consume any input at all.
      //
      // Do note that we do *not* assign this preliminary result to `node.consumption`!
      // We are inside a recursive call to this rule and do expect to produce a valid
      // answer in the outer call which executes the traversal code further below.
      return {
        min: 0,
        max: 0,
        firstSet: {
          rule: [node]
        }
      }; 
    }

    arrays.each(node.annotations, function(annotation) {
      patch.annotation(annotation, null, node, parent);
    });

    // When we return from this traversal (`patch()`) we set the rule's `node.consumption` value 
    // as we are guaranteed to return only after having completed the calculation,
    // including recursive calls to this rule's handler (caught above in the
    // `else if (node.consumption === false)` conditional branch), hence we can
    // be sure about the calculated *minimum* consumption level. The *maximum*
    // consumption level will be a pessimistic estimate, but we're fine with that.
    node.consumption = patch(node.expression, node);
    return node.consumption;
  }

  function calcRulePost(node, parent, returnValue) {
    // This one works in tandem with its caller `calcPost` and
    // the `calcRuleVisitor` itself to ensure that the conditions
    // mentioned in `calcRuleVisitor` are upheld, also when *multiple*
    // recursive visits occur, e.g. in the rule definition
    //
    //     rule = A rule rule;
    //
    // where the most important condition is that `rule.consumption`
    // is *not set* by any of the inner recursive calls which should
    // report back the 'fail'='nothing-consumed' info object on
    // all occasions.
    //
    // Note that for this to work, `calcPost` does *not* set the
    // `node.consumption` for any nodes which have custom post handlers
    // (such as this one for the 'rule' AST nodes).
    // 
    // You will observe that all other AST nodes' custom post handlers
    // set the `node.consumption` value themselves.
    return returnValue;   // overriding the behaviour of `calcPost`
  }

  function calcSimpleAnd(node, parent, returnValue) {
    // As this is a predicate, it will never consume any input!
    node.consumption = {
      min: 0,
      max: 0,
      firstSet: returnValue.firstSet
    };
    return node.consumption;
  }

  function calcSimpleNot(node, parent, returnValue) {
    // As this is a predicate, it will never consume any input!
    node.consumption = {
      min: 0,
      max: 0,
      firstSet: returnValue.firstSet
    };
    return node.consumption;
  }

  function calcOptional(node, parent, returnValue) {
    node.consumption = {
      min: 0,
      max: returnValue.max,
      firstSet: returnValue.firstSet
    };
    return node.consumption;
  }

  function calcZeroOrMore(node, parent, returnValue) {
    node.consumption = {
      min: 0,
      max: (returnValue.max !== 0 ? Infinity : 0),
      firstSet: returnValue.firstSet
    };
    return node.consumption;
  }

  function calcOneOrMore(node, parent, returnValue) {
    node.consumption = {
      min: returnValue.min,
      max: (returnValue.max !== 0 ? Infinity : 0),
      firstSet: returnValue.firstSet
    };
    return node.consumption;
  }

  patch = visitor.build({
    rule:         calcRuleVisitor,

    __post__:     calcPost
  });

  patch(ast);
};
