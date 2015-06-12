/* global jasmine, PEG, beforeEach */
"use strict";

// Usage:
// 
//     describe("bla bla", function() {
//       beforeEach(function() {
//         this.addMatchers(require("spec/unit/compiler/passes/helpers.js"));
//       });
//       ...
//     });
module.exports = {
  toChangeAST: function() {
    return {
      compare: function(grammar) {
        function matchDetails(value, details) {
          function isArray(value) {
            return Object.prototype.toString.apply(value) === "[object Array]";
          }

          function isObject(value) {
            return value !== null && typeof value === "object";
          }

          var i, key;

          if (isArray(details)) {
            if (!isArray(value)) { 
              return false; 
            }

            if (value.length !== details.length) { 
              return false; 
            }
            for (i = 0; i < details.length; i++) {
              if (!matchDetails(value[i], details[i])) { 
                return false; 
              }
            }

            return true;
          } else if (isObject(details)) {
            if (!isObject(value)) { 
              return false; 
            }

            for (key in details) {
              if (details.hasOwnProperty(key)) {
                if (!(key in value)) { 
                  return false; 
                }

                if (!matchDetails(value[key], details[key])) { 
                  return false; 
                }
              }
            }

            return true;
          } else {
            return value === details;
          }
        }

        var options = arguments.length > 2 ? arguments[1] : {},
            details = arguments[arguments.length - 1],
            ast     = PEG.parser.parse(grammar);

        //this.actual(ast, options);

        var pass = matchDetails(ast, details);
        return {
          pass: pass,
          message: "Expected the pass "
                 + "with options " + jasmine.pp(options) + " "
                 + (this.isNot ? "not " : "")
                 + "to change the AST " + jasmine.pp(ast) + " "
                 + "to match " + jasmine.pp(details) + ", "
                 + "but it " + (this.isNot ? "did" : "didn't") + "."
        };
      }
    };
  },

  toReportError: function() {
    return {
      compare: function(grammar, details) {
        var ast = PEG.parser.parse(grammar);

        try {
          this.actual(ast);

          return {
            pass: false,
            message: "Expected the pass to report an error"
                   + (details ? " with details " + jasmine.pp(details) : "") + ", "
                   + "for grammar " + jasmine.pp(grammar) + ", "
                   + "but it didn't."
          };
        } catch (e) {
          /*
           * Should be at the top level but then JSHint complains about bad for
           * in variable.
           */
          var key, message;

          if (details) {
            for (key in details) {
              if (details.hasOwnProperty(key)) {
                if (!this.env.equals_(e[key], details[key])) {
                  message = "Expected the pass to report an error "
                         + (details ? "with details " + jasmine.pp(details) + " " : "")
                         + "for grammar " + jasmine.pp(grammar) + ", "
                         + "but " + jasmine.pp(key) + " "
                         + "is " + jasmine.pp(e[key]) + ".";

                  return {
                    pass: false,
                    message: message
                  };
                }
              }
            }
          }

          return {
            pass: true,
            message: "Expected the pass not to report an error"
                   + "for grammar " + jasmine.pp(grammar) + ", "
                   + "but it did."
          };
        }
      }
    };
  },

  toParse: function() {
    return {
      compare: function(input) {
        var options  = arguments.length > 2 ? arguments[1] : {},
            expected = arguments[arguments.length - 1],
            result;

        try {
          result = this.actual.parse(input, options);

          this.message = function() {
            return "Expected " + jasmine.pp(input) + " "
                 + "with options " + jasmine.pp(options) + " "
                 + (this.isNot ? "not " : "")
                 + "to parse as " + jasmine.pp(expected) + ", "
                 + "but it parsed as " + jasmine.pp(result) + ".";
          };

          return this.env.equals_(result, expected);
        } catch (e) {
          this.message = function() {
            return "Expected " + jasmine.pp(input) + " "
                 + "with options " + jasmine.pp(options) + " "
                 + "to parse as " + jasmine.pp(expected) + ", "
                 + "but it failed to parse with message "
                 + jasmine.pp(e.message) + ".";
          };

          return false;
        }
      }
    };
  },

  toFailToParse: function() {
    return {
      compare: function(input) {
        var options = arguments.length > 2 ? arguments[1] : {},
            details = arguments.length > 1
                        ? arguments[arguments.length - 1]
                        : undefined,
            result;

        try {
          result = this.actual.parse(input, options);

          this.message = function() {
            return "Expected " + jasmine.pp(input) + " "
                 + "with options " + jasmine.pp(options) + " "
                 + "to fail to parse"
                 + (details ? " with details " + jasmine.pp(details) : "") + ", "
                 + "but it parsed as " + jasmine.pp(result) + ".";
          };

          return false;
        } catch (e) {
          /*
           * Should be at the top level but then JSHint complains about bad for
           * in variable.
           */
          var key;

          if (this.isNot) {
            this.message = function() {
              return "Expected " + jasmine.pp(input)
                   + "with options " + jasmine.pp(options) + " "
                   + "to parse, "
                   + "but it failed with message "
                   + jasmine.pp(e.message) + ".";
            };
          } else {
            if (details) {
              for (key in details) {
                if (details.hasOwnProperty(key)) {
                  if (!this.env.equals_(e[key], details[key])) {
                    this.message = function() {
                      return "Expected " + jasmine.pp(input) + " "
                           + "with options " + jasmine.pp(options) + " "
                           + "to report an error"
                           + (details ? " with details " + jasmine.pp(details) + " " : "")
                           + "for grammar " + jasmine.pp(grammar) + ", "
                           + "but " + jasmine.pp(key) + " "
                           + "is " + jasmine.pp(e[key]) + ".";
                    };

                    return false;
                  }
                }
              }
            }
          }

          return true;
        }
      }
    };
  },

  toBeObject: function() {
    return {
      compare: function() {
        this.message = function() {
          return "Expected " + jasmine.pp(this.actual) + " "
               + (this.isNot ? "not " : "")
               + "to be an object.";
        };

        return this.actual !== null && typeof this.actual === "object";
      }
    };
  },

  toBeArray: function() {
    return {
      compare: function() {
        this.message = function() {
          return "Expected " + jasmine.pp(this.actual) + " "
               + (this.isNot ? "not " : "")
               + "to be an array.";
        };

        return Object.prototype.toString.apply(this.actual) === "[object Array]";
      }
    };
  },

  toBeFunction: function() {
    return {
      compare: function() {
        this.message = function() {
          return "Expected " + jasmine.pp(this.actual) + " "
               + (this.isNot ? "not " : "")
               + "to be a function.";
        };

        return typeof this.actual === "function";
      }
    };
  }
};

