"use strict";

var classes = require("./utils/classes");

/* Thrown when the grammar contains an error. */
function GrammarError(message, location) {
  var err;

  this.name = "GrammarError";
  this.location = location;
  this.message = buildMessage();
  this.problems = problems;
  if (typeof Error.captureStackTrace !== "function") {
    err = new Error(this.message);
    if (typeof Object.defineProperty === "function") {
      Object.defineProperty(this, "stack", {
        get: function () {
          return err.stack;
        }
      });
    } else {
      this.stack = err.stack;
    }
  } else {
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
