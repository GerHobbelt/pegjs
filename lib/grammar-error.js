"use strict";

var classes = require("./utils/classes");

/* Thrown when the grammar contains an error. */
function GrammarError(message, extra_info) {
  var err;

  extra_info = extra_info || {};

  this.name = "GrammarError";
  this.location = extra_info.location;
  this.problems = extra_info.problems;
  this.message = this.constructor.buildMessage(message, extra_info).join('\n');
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
    msgs.push(this.buildLocation(location) + message);
  }
  
  var problems = extra_info.problems || [];
  for (var line = 0; line < problems.length; line++) {
    var problem = problems[line] || [];
    message = problem[1];
    location = problem[2];
    var level = problem[0] || "?LEVEL?";
    msgs.push(level + ": " + this.buildLocation(location) + message);
  }

  return msgs;
};

GrammarError.buildLocation = function grammarErrorBuildLocation(location, postfix_str) {
  if (location) {
    // Apply default postfix string when non has been specified:
    if (postfix_str == null) {
      postfix_str = ": ";
    }
    return "line " + location.start.line + ", column " + location.start.column + postfix_str;
  }
  return "";
};


classes.subclass(GrammarError, Error);

module.exports = GrammarError;
