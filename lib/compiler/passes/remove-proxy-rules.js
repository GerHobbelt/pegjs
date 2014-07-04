var arrays  = require("../../utils/arrays"),
    visitor = require("../visitor");

/*
 * Removes proxy rules -- that is, rules that only delegate to another rule.
 */
function removeProxyRules(ast, options) {
  var collector = options.collector;

  function isProxyRule(node) {
    if (node.type === "rule" && node.expression.type === "rule_ref") {
      return {
        from: node,
        to: node.expression
      };
    }
    else if (node.type === "rule" && node.expression.type === "labeled" && node.expression.expression.type === "rule_ref") {
      return {
        from: node,
        to: node.expression.expression
      };
    }
    return false;
  }

  function replaceRuleRefs(ast, from, to) {
    var replace = visitor.build({
    rule_ref:
      function(node) {
        if (node.name === from) {
          node.name = to;
          collector.emitInfo(
            "Reference to Proxy Rule \"" + from + "\" replaced with rule \"" + to + "\".",
            node
          );
        }
      }
    });

    replace(ast);
  }

  var indices = [];

  arrays.each(ast.rules, function(rule, i) {
    var targetLabel;
    var proxyInfo = isProxyRule(rule);
    if (proxyInfo) {
      collector.emitInfo(
        "Rule \"" + rule.name + "\" is a proxy rule. (It will be reduced.)",
        rule
      );
      replaceRuleRefs(ast, proxyInfo.from.name, proxyInfo.to.name);

      // and patch the label/description of the target too:
      if (proxyInfo.from.expression.type === 'labeled' && proxyInfo.from.expression.label) {
        var sourceLabel = proxyInfo.from.expression;
        var targetRule = asts.findRule(ast, proxyInfo.to.name);
        if (targetRule.expression.type !== 'labeled') {
          collector.emitInfo(
            "Rule \"" + targetRule.name + "\" is updated with the label from the proxy rule\"" + proxyInfo.from.name + "\".",
            targetRule
          );
          targetLabel = objects.defaults({
            expression: targetRule.expression
          }, sourceLabel);
          targetRule.expression = targetLabel;
        }
        else if (targetRule.expression.type === 'labeled' && !targetRule.expression.label) {
          collector.emitInfo(
            "Rule \"" + targetRule.name + "\" is updated with the label from the proxy rule\"" + proxyInfo.from.name + "\".",
            targetRule
          );
          targetLabel = targetRule.expression;
          targetLabel.label = sourceLabel.label;
          targetLabel.region = sourceLabel.region;
          if (!targetLabel.description) {
            targetLabel.description = sourceLabel.description;
          }
        }
      }

      if (!arrays.contains(options.allowedStartRules, proxyInfo.from.name)) {
        indices.push(i);
      }
    }
  });

  indices.reverse();

  arrays.each(indices, function(i) { 
    ast.rules.splice(i, 1); 
  });
}

module.exports = removeProxyRules;
