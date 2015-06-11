var visitor      = require("../visitor"),
    GrammarError = require("../../grammar-error");

/* Checks that there are no duplicate labels within a rule. */
module.exports = function reportDuplicateLabels(ast, options) {
  var collector = options.collector;
  var check = visitor.build({
    rule: function(node, data) {
      check(node.expression, {
        nodeName: node.name,
        labels: {}
      });
    },

    labeled: function(node, data) {
      if (!data.labels) {
        return;
      }
      
      if (data.labels.hasOwnProperty(node.label)) {
        throw new GrammarError(
          'Duplicate label \"' + node.label + '\" detected for rule \"' + data.nodeName + '\".'
        );
      }

      data.labels[node.label] = 1;
    }
  });

  check(ast);
};
