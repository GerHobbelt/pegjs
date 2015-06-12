"use strict";

var visitor      = require("../visitor"),
    arrays       = require("../../utils/arrays"),
    objects      = require("../../utils/objects"),
    asts         = require("../asts");

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
};
