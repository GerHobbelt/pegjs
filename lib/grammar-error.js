"use strict";

var classes = require("./utils/classes");

/* Thrown when the grammar contains an error. */
function GrammarError(message, extra_info) {
  var err;

  extra_info = extra_info || {};

  this.name = "GrammarError";
  this.location = extra_info.location;
  this.problems = extra_info.problems;
  this.message = GrammarError.buildMessage(message, extra_info).join('\n');
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
}

GrammarError.buildMessage = function grammarErrorBuildMessage(message, extra_info) {
  extra_info = extra_info || {};
  var msgs = [];
  var location = extra_info.location;

  if (message) {
    if (location && location.begin) {
      message = "Line " + location.begin.line + ", column " + location.begin.column + ": " + message;
    }
    msgs.push(message);
  }
  
  var problems = extra_info.problems || [];
  for (var line = 0; line < problems.length; line++) {
    var problem = problems[line] || [];
    message = problem[1];
    location = problem[2];
    var level = problem[0] || "?LEVEL?";
    if (location && location.begin) {
      message = "line " + location.begin.line + ", column " + location.begin.column + ": " + message;
    }
    msgs.push(level + ": " + message);
  }

  return msgs;
};


classes.subclass(GrammarError, Error);

module.exports = GrammarError;
