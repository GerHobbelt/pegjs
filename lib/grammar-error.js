var utils = require("./utils");

/* Thrown when the grammar contains an error. */
module.exports = function(message, node, problems) {
  this.name = "GrammarError";
  this.region = node.region;
  this.message = buildMessage();
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, this.constructor);
  }

  function buildMessage() {
    if (node.region)
      return "Line "+node.region.begin.line+", column "+node.region.begin.column+": "+message;
    return message;
  }
};

utils.subclass(module.exports, Error);
