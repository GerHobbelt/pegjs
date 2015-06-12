"use strict";

var visitor      = require("../visitor"),
    arrays       = require("../../utils/arrays"),
    objects      = require("../../utils/objects"),
    asts         = require("../asts");

module.exports = function(ast, options) {
  var collector = options.collector;
  var patch;

  var pre_handlers = {
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

  // grammar AST is grammar -> rules[] -> ...
  
  patch = visitor.build({
    __pre__:             visitPre,
    __annotation_pre__:  visitAnnotationPre
  });

  patch(ast);
};

