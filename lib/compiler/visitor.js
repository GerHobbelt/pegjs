var objects = require("../utils/objects"),
    arrays  = require("../utils/arrays");

/* Simple AST node visitor builder. */
var visitor = {
  build: function(functions) {
    var visit = function (node, parent) {
      var extraArgs = Array.prototype.slice.call(arguments, 2);

      // execute this function for each visited node:
      functions.__pre__.apply(functions, arguments);
      
      var returnValue = functions[node.type].apply(functions, arguments);

      // execute this function for each visited node:
      return functions.__post__.apply(functions, [node, parent, returnValue].concat(extraArgs));
    };

    visit.annotation = function (annotation, parent_annotation, node, parent) {
      var extraArgs = Array.prototype.slice.call(arguments, 4);

      // execute this function for each visited annotation/param node:
      functions.__annotation_pre__.apply(functions, arguments);
      
      var returnValue = functions[annotation.type].apply(functions, arguments);

      // execute this function for each visited annotation/param node:
      return functions.__annotation_post__.apply(functions, [annotation, parent_annotation, node, parent, returnValue].concat(extraArgs));
    };

    function visitAnnotationPre(annotation, parent_annotation, node, parent) { 
    }

    function visitAnnotationPost(annotation, parent_annotation, node, parent, returnValue) { 
      return returnValue;
    }

    function visitPre(node, parent) { 
    }

    function visitPost(node, parent, returnValue) { 
      return returnValue;
    }

    function visitNop(node, parent) {
      return undefined; 
    }

    function visitExpression(node, parent) {
      var extraArgs = Array.prototype.slice.call(arguments, 2);

      arrays.each(node.annotations, function(annotation) {
        visit.annotation.apply(null, [annotation, null, node, parent].concat(extraArgs));
      });

      return visit.apply(null, [node.expression, node].concat(extraArgs));
    }

    function visitRange(node, parent) { 
      var extraArgs = Array.prototype.slice.call(arguments, 2);

      arrays.each(node.annotations, function(annotation) {
        visit.annotation.apply(null, [annotation, null, node, parent].concat(extraArgs));
      });

      var rv = visit.apply(null, [node.expression, node].concat(extraArgs));
      if (node.delimiter !== null) {
        visit.apply(null, [node.delimiter, node].concat(extraArgs));
      }
      return rv;
    }

    function visitChildren(property) {
      return function(node, parent) {
        var extraArgs = Array.prototype.slice.call(arguments, 2);

        arrays.each(node.annotations, function(annotation) {
          visit.annotation.apply(null, [annotation, null, node, parent].concat(extraArgs));
        });

        arrays.each(node[property], function(child) {
          visit.apply(null, [child, node].concat(extraArgs));
        });
        return undefined;
      };
    }

    function visitGrammar(node, parent) {
      var extraArgs = Array.prototype.slice.call(arguments, 2);

      if (node.initializer) {
        visit.apply(null, [node.initializer, node].concat(extraArgs));
      }

      arrays.each(node.annotations, function(annotation) {
        visit.annotation.apply(null, [annotation, null, node, parent].concat(extraArgs));
      });

      arrays.each(node.rules, function(rule) {
        visit.apply(null, [rule, node].concat(extraArgs));
      });
      return undefined;
    }

    function visitParam(param, annotation, node, parent) { 
      //var extraArgs = Array.prototype.slice.call(arguments, 4);
      return undefined;
    }

    function visitAnnotation(annotation, parent_annotation, node, parent) {
      var extraArgs = Array.prototype.slice.call(arguments, 4);

      arrays.each(annotation.params, function(child) {
        visit.annotation.apply(null, [child, annotation, node, parent].concat(extraArgs));
      });
      return undefined;
    }

    var DEFAULT_FUNCTIONS = {
          grammar:      visitGrammar,                     // (node, parent)
          initializer:  visitNop,                         // (node, parent)
          rule:         visitExpression,                  // (node, parent)
          named:        visitExpression,                  // (node, parent)
          choice:       visitChildren("alternatives"),    // (node, parent)
          action:       visitExpression,                  // (node, parent)
          sequence:     visitChildren("elements"),        // (node, parent)
          labeled:      visitExpression,                  // (node, parent)
          unlabeled:    visitExpression,                  // (node, parent)
          text:         visitExpression,                  // (node, parent)
          simple_and:   visitExpression,                  // (node, parent)
          simple_not:   visitExpression,                  // (node, parent)
          optional:     visitExpression,                  // (node, parent)
          zero_or_more: visitExpression,                  // (node, parent)
          one_or_more:  visitExpression,                  // (node, parent)
          range:        visitRange,                       // (node, parent)
          semantic_and: visitNop,                         // (node, parent)
          semantic_not: visitNop,                         // (node, parent)
          rule_ref:     visitNop,                         // (node, parent)
          literal:      visitNop,                         // (node, parent)
          "class":      visitNop,                         // (node, parent)
          regex:        visitNop,                         // (node, parent)
          code:         visitNop,                         // (node, parent)
          any:          visitNop,                         // (node, parent)
          epsilon:      visitNop,                         // (node, parent)

          annotation:       visitAnnotation,              // (annotation, parent_annotation, node, parent)
          param_keyword:    visitParam,                   // (annotation, parent_annotation, node, parent)
          param_string:     visitParam,                   // (annotation, parent_annotation, node, parent)
          param_number:     visitParam,                   // (annotation, parent_annotation, node, parent)
          param_range:      visitParam,                   // (annotation, parent_annotation, node, parent)

          __pre__:      visitPre,                         // (node, parent)
          __post__:     visitPost,                        // (node, parent, returnValue)
          
          __annotation_pre__:  visitAnnotationPre,        // (annotation, parent_annotation, node, parent)
          __annotation_post__: visitAnnotationPost        // (annotation, parent_annotation, node, parent, returnValue)
        };

    functions = objects.defaults(functions, DEFAULT_FUNCTIONS);

    return visit;
  }
};

module.exports = visitor;
