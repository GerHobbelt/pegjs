"use strict";

var asts         = require("../asts"),
    visitor      = require("../visitor");

/*
 * Reports expressions that don't consume any input inside |*| or |+| in the
 * grammar, which prevents infinite loops in the generated parser.
 */
function reportInfiniteLoops(ast, options) {
  var collector = options.collector;

  var check = visitor.build({
    zero_or_more: function(node) {
      if (asts.matchesEmpty(ast, node.expression)) {
        collector.emitError("Infinite loop detected at rule \"" + node.name + "\".", node);
      }
    },

    one_or_more: function(node) {
      if (asts.matchesEmpty(ast, node.expression)) {
        collector.emitError("Infinite loop detected at rule \"" + node.name + "\".", node);
      }
    }
  });

  check(ast);
}

module.exports = reportInfiniteLoops;
