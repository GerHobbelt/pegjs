var GrammarError = require("../../grammar-error"),
    visitor      = require("../visitor");

/* Checks that there are no duplicate rules within the grammer. */
module.exports = function reportDuplicateRules(ast, options) {
  var collector = options.collector;

  if ( options && options.reportDuplicateRules == true ) {
    var rules = {};
    
    var check = visitor.build({
      rule: function checkRule(node, parent) {
        var ruleName = node.name;
        
        if ( rules[ruleName] ) {
          var region = ruleSet[node.name].region;
          var str = "";
          if (region && region.begin) {
            str = " (First definition is at line " + region.begin.line + ", column " + region.begin.column + ".)";
          }
          region = node.region;
          if (region && region.begin) {
            str += " (Duplicate definition is at line " + region.begin.line + ", column " + region.begin.column + ".)";
          }
          // throw new GrammarError(....):
          collector.emitError(
            "Rule \"" + node.name + "\" is defined at least twice." + str +
            'To disable this error, simply set the option "reportDuplicateRules" to "false" or "0".',
            node.region
          );
        }
  
        rules[ruleName] = true;
      }
    });
  
    check(ast);
  }
};

