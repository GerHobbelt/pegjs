/* Warning, if some rules redefined. */
module.exports = function(ast, options) {
  var collector = options.collector;
  var rules = ast.rules;

  function origin(r) {
    if (r && r.location) {
      var location = r.location;
      return "line " + location.start.line
            +", column " + location.start.column;
    }
    return "(...unspecified location...)";
  }

  // Map node name to node itself.
  var names = {};
  for (var i = 0; i < rules.length; ++i) {
    var rule = rules[i];
    if (names.hasOwnProperty(rule.name)) {
      var r = names[rule.name];
      collector.emitWarning(
        "Rule \"" + rule.name + "\" redefined; previously defined in " + origin(r) + ".",
        rule
      );
    } else {
      names[rule.name] = rule;
    }
  }
};
