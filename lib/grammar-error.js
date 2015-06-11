var classes = require("./utils/classes");

/* Thrown when the grammar contains an error. */
function GrammarError(message, location) {
  this.name = "GrammarError";
  this.location = location;
  this.message = buildMessage();
  this.problems = problems;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, this.constructor);
  }

  function buildMessage() {
    if (location) {
      return "Line " + location.begin.line + ", column " + location.begin.column + ": " + message;
    }
    return message;
  }
}

classes.subclass(GrammarError, Error);

module.exports = GrammarError;
