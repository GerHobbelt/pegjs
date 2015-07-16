"use strict";

var visitor      = require("../visitor");

/* Checks that there are no duplicate rules within the grammar. */
module.exports = function reportDuplicateRules(ast, options) {
  var collector = options.collector;

  if (options.reportDuplicateRules) {
    var rules = {};
    
    var check = visitor.build({
      rule: function checkRule(node, parent) {
        var ruleName = node.name;
        
        if ( rules[ruleName] ) {
          var location = rules[ruleName].location;
          var str = "";
          if (location) {
            str = " (First definition is at line " + location.start.line + ", column " + location.start.column + ".)";
          }
          location = node.location;
          if (location) {
            str += " (Duplicate definition is at line " + location.start.line + ", column " + location.start.column + ".)";
          }
          // throw new GrammarError(....):
          collector.emitError(
            "Rule \"" + ruleName + "\" is defined at least twice." + str +
            'To disable this error, simply set the option "reportDuplicateRules" to "false" or "0".'
          );
        }
  
        rules[ruleName] = true;
      }
    });
  
    check(ast);
  }
};

