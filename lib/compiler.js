var utils        = require("./utils"),
    GrammarError = require("./grammar-error");

module.exports = {
  /*
   * Compiler passes.
   *
   * Each pass is a function that is passed the AST. It can perform checks on it
   * or modify it as needed. If the pass encounters a semantic error, it throws
   * |PEG.GrammarError|.
   */
  passes: {
    check: {
      reportUnusedRules:    require("./compiler/passes/report-unused-rules"),
      reportRedefinedRules: require("./compiler/passes/report-redefined-rules"),
      reportMissingRules:   require("./compiler/passes/report-missing-rules"),
      reportLeftRecursion:  require("./compiler/passes/report-left-recursion")
    },
    transform: {
      removeProxyRules:     require("./compiler/passes/remove-proxy-rules")
    },
    generate: {
      generateBytecode:     require("./compiler/passes/generate-bytecode"),
      generateJavascript:   require("./compiler/passes/generate-javascript")
    }
  },

  /*
   * Generates a parser from a specified grammar AST. Throws |PEG.GrammarError|
   * if the AST contains a semantic error. Note that not all errors are detected
   * during the generation and some may protrude to the generated parser and
   * cause its malfunction.
   */
  compile: function(ast, passes) {
    var options = arguments.length > 2 ? utils.clone(arguments[2]) : {},
        stage,
        problems = [],
        errors = 0,
        collector = {
          emitFatalError: function() {
            throw utils.construct(GrammarError, arguments);
          },
          emitError: function() {
            ++errors;
            problems.push(['error'].concat(Array.prototype.slice.call(arguments, 0)));
          },
          emitWarning: function() {
            problems.push(['warning'].concat(Array.prototype.slice.call(arguments, 0)));
          },
          emitInfo: function() {
            problems.push(['info'].concat(Array.prototype.slice.call(arguments, 0)));
          },
        };

    /*
     * Extracted into a function just to silence JSHint complaining about
     * creating functions in a loop.
     */
    function runPass(pass) {
      pass(ast, options);
    }
    function chain(f1, f2) {
      return function() {
        f1.apply(null, arguments);
        f2.apply(null, arguments);
      }
    }

    utils.defaults(options, {
      allowedStartRules:  [ast.rules[0].name],
      cache:              false,
      optimize:           "speed",
      output:             "parser"
    });
    var userCollector = options.collector;
    if (userCollector) {
      for (var f in userCollector) {
        if (userCollector.hasOwnProperty(f) && collector.hasOwnProperty(f)) {
          userCollector[f] = chain(userCollector[f], collector[f]);
        }
      }
    } else {
      options.collector = collector;
    }

    for (stage in passes) {
      if (passes.hasOwnProperty(stage)) {
        // Clear array.
        problems.length = 0;
        errors = 0;
        utils.each(passes[stage], runPass);
        // Collect all errors by stage
        if (errors !== 0) {
          throw new GrammarError("Stage "+stage+" contains errors.", problems);
        }
      }
    }
    switch (options.output) {
      case "parser": return eval(ast.code);
      case "source": return ast.code;
    }
  },
  /// @return Array of arrays: [<index in bytecode>, <opcode value>, <opcode name>, <array of opcode args>]
  decompile: function(bc) {
    var op = require('./compiler/opcodes');
    var names = new Array(op.length);
    for (var k in op) { names[op[k]] = k;}
    /// @return Count of arguments for opcode at index `i`.
    function len(i) {
      switch (bc[i]) {
        /* Stack Manipulation */
        case op.PUSH: return 1;
        case op.PUSH_CURR_POS: return 0;
        case op.POP: return 0;
        case op.POP_CURR_POS: return 0;
        case op.POP_N: return 1;
        case op.NIP: return 0;
        case op.NIP_CURR_POS: return 0;
        case op.APPEND: return 0;
        case op.WRAP: return 1;
        case op.TEXT: return 0;
        /* Conditions and Loops */
        case op.IF: return 2;
        case op.IF_ERROR: return 2;
        case op.IF_NOT_ERROR: return 2;
        case op.WHILE_NOT_ERROR: return 1;
        /* Matching */
        case op.MATCH_ANY: return 2;
        case op.MATCH_STRING: return 3;
        case op.MATCH_STRING_IC: return 3;
        case op.MATCH_REGEXP: return 3;
        case op.ACCEPT_N: return 1;
        case op.ACCEPT_STRING: return 1;
        case op.FAIL: return 1;
        /* Calls */
        case op.REPORT_SAVED_POS: return 1;
        case op.REPORT_CURR_POS: return 0;
        case op.CALL: return 3 + bc[i+2];
        /* Rules */
        case op.RULE: return 1;
        /* Failure Reporting */
        case op.SILENT_FAILS_ON: return 0;
        case op.SILENT_FAILS_OFF: return 0;
        /* Checking array length */
        case op.IF_ARRLEN_MIN: return 2;
        case op.IF_ARRLEN_MAX: return 2;
        case op.BREAK: return 1;
        default: throw new Error('invalid opcode in pos '+i+': '+bc[i]);
      }
    }
    /// @return Mnemonic name of opcode at index `i`.
    function name(i) {
      var result = names[bc[i]];
      if (result !== undefined) return result;
      // for (var k in op) { if (op[k] == opcode) return k; }
      throw new Error('invalid opcode in pos '+i+': '+bc[i]);
    }

    var result = [];
    for (var i = 0; i < bc.length; ++i) {
      result.push([i, bc[i], name(i), bc.slice(i+1, i+1+len(i))]);
      i += len(i);
    }
    return result;
  }
};
