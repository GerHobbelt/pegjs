"use strict";

var visitor      = require("../visitor"),
    arrays       = require("../../utils/arrays"),
    objects      = require("../../utils/objects"),
    asts         = require("../asts");

function setupMemoization(ast, options) {
  var collector = options.collector;
  var patch;

  var pre_handlers = {
    rule:       visitRuleDefinition,

    annotation: visitAnnotation
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


  var annoNames = ['nocache', 'cache'];
  var cacheAllParamNames = ['none', 'all'];

  var cacheAll = null;
  var mustCache = false;

  var currentRule = null;

  function visitAnnotation(annotation, parent_annotation, node, parent, context) {
    var caching, memo, a, mode, loc;

    // Scan the grammar for annotations which affect all rules and/or influence the options...
    //
    // We don't care how many times a global cache(all) or cache(none) was specified: the first one wins.
    if (annoNames.indexOf(annotation.name) >= 0) {
      memo = !!annoNames.indexOf(annotation.name);    // use the index as a boolean: cache=1, nocache=0
      
      a = arrays.find(annotation.params, function (arg) {
        return cacheAllParamNames.indexOf(arg.value) >= 0;
      });

      if (a !== false) {
        mode = !!cacheAllParamNames.indexOf(a.value);    // use the index as a boolean: all=1, none=0
        if (annotation.name === 'nocache') {
          caching = memo ^ mode;
        } else {
          caching = memo ^ mode;
        }

        if (cacheAll === false || cacheAll === true) {
          loc = annotation.location || node.location;
          collector.emitError(
            "Multiple cache(all/none) declarations; only the first one is used." +
            (loc ? " The one at line " + loc.begin.line + ", column " + loc.begin.column + " is ignored." : ""),
            node
          );
        }

        // signal whether the grammar spec demands memoization overall
        mustCache |= !!caching;

        cacheAll = !!caching;
      } else {
        // then this is cache/nocache directive for only the current rule
        if (currentRule.memoize === false || currentRule.memoize === true) {
          loc = annotation.location;
          collector.emitError(
            "Multiple cache() declarations apply to the same rule \"" + currentRule.name + "\"; only the first one is used." +
            (loc ? " The one at line " + loc.begin.line + ", column " + loc.begin.column + " is ignored." : ""),
            node
          );
        }

        // we can *force* (override) the annotations by specifying `--cache` multiple times on the command line:
        if (options.cache > 1) {
          memo = true;
        }

        // signal whether this rule requires memoization
        mustCache |= !!memo;

        currentRule.memoize = !!memo;
      }
    }
  }

  function visitRuleDefinition(node, parent, context) {
    currentRule = node;
  }

  // grammar AST is grammar -> rules[] -> ...
  
  patch = visitor.build({
    __pre__:             visitPre,
    __annotation_pre__:  visitAnnotationPre
  });

  patch(ast);

  // we can *force* (override) the annotations by specifying `--cache` multiple times on the command line:
  if (options.cache > 1) {
    cacheAll = options.cache;
    mustCache = true;
  }

  // When ANY rule's `cache` annotation turned memoization *ON*, we need to enable caching whether we like it or not.
  if (mustCache && !options.cache) {
    collector.emitInfo(
      "The cache/nocache annotations in the grammar override the parser cache/memoize option to be MEMOIZE=ON."
    );
    options.cache = 1;
  }
  else if (!mustCache && cacheAll === false) {
    collector.emitInfo(
      "The cache/nocache annotations in the grammar override the parser cache/memoize option to be MEMOIZE=OFF."
    );
    options.cache = 0;
  }

  // set the default memoization mode for all rules which don't have a specific override
  if (cacheAll !== false && cacheAll !== true) {
    cacheAll = options.cache;
  }
  ast.memoize = cacheAll;
  // and make it a little easier for us later on in the show: just set it for all those rules directly:
  arrays.each(ast.rules, function (r) {
    if (r.memoize !== false && r.memoize !== true) {
      r.memoize = cacheAll;
    }
  }); 
}

module.exports = setupMemoization;
