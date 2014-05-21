var classes = require("./utils/classes");

/* Thrown when the grammar contains an error. */
function GrammarError(message) {
  this.name = "GrammarError";
  this.region = node.region;
  this.message = buildMessage();
  this.problems = problems;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, this.constructor);
  }

  function buildMessage() {
    if (node.region)
      return "Line " + node.region.begin.line + ", column " + node.region.begin.column + ": " + message;
    return message;
  }
}

classes.subclass(GrammarError, Error);

module.exports = GrammarError;
