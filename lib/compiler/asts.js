var arrays = require("../utils/arrays");

/* AST utilities. */
var asts = {
  findRule: function(ast, name) {
    return arrays.find(ast.rules, function(r) { return r.name === name; });
  },

  indexOfRule: function(ast, name) {
    return arrays.indexOf(ast.rules, function(r) { return r.name === name; });
  },

  /// Finds first annotation with given name or |undefined|, if such annotation not exist.
  findAnnotation: function(rule, name) {
    return arrays.find(rule.annotations, function(a) { return a.name === name; });
  },

  /// Finds all annotations with given name at given rule or empty array, if such annotations not exist.
  findAnnotations: function(rule, name) {
    return arrays.filter(rule.annotations, function(a) { return a.name === name; });
  },

  /// Find all annotations with given name in any of the given rules. Return an array of annotations or empty array when none exist.
  globalFindAnnotations: function(rules, name) {
    var rv = [];
    arrays.each(rules, function(rule, index) {
      rv.concat(arrays.filter(rule.annotations, function(a) { return a.name === name; }));
    });
    return rv;
  },

  /// Apply the given annotation `annotation` to each rule when none of the given annotation names `names` exist for that rule.
  globalApplyAnnotationConditionally: function(rules, annotation, annotation_names) {
    if (annotation_names == null) {
      // no 'blocking' annotation name was specified
      annotation_names = [];
    } else if (!Array.isArray(annotation_names)) {
      // assume a single name was passed
      annotation_names = [annotation_names];
    }
    arrays.each(rules, function(rule, index) {
      if (!arrays.find(rule.annotations, function(a) { return annotation_names.indexOf(a.name) >= 0; })) {
        // none of the 'blocking' annotation_names exist for this rule, hence we apply the annotation to it:
        if (!rule.annotations) {
          rule.annotations = [];
        }
        rule.annotations.concat(annotation);
      }
    });
  }
};

module.exports = asts;
