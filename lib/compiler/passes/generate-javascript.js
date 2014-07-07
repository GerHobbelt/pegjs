var arrays = require("../../utils/arrays"),
    asts   = require("../asts"),
    op     = require("../opcodes"),
    js     = require("../javascript");

/* Generates parser JavaScript code. */
function generateJavascript(ast, options) {
  /* These only indent non-empty lines to avoid trailing whitespace. */
  function indent2(code)  { return code.replace(/^(.+)$/gm, '  $1');         }
  function indent4(code)  { return code.replace(/^(.+)$/gm, '    $1');       }
  function indent8(code)  { return code.replace(/^(.+)$/gm, '        $1');   }
  function indent10(code) { return code.replace(/^(.+)$/gm, '          $1'); }

  function getOpcodeName(opcode) {
    for (var k in op) {
      if (op[k] === opcode) {
        return k + '=' + opcode;
      }
    }
    return opcode;
  }

  function generateTables() {
    function createFunc(a) { 
      return 'function(' + a[0].join(', ') + ') { ' + a[1] + ' }'; 
    }

    if (options.optimize === "size") {
      return [
        '//{ Tables',
        'peg$consts = [',
           indent2(ast.consts.join(',\n')),
        '],',
        'peg$actions = [',
           indent2(arrays.map(ast.actions, createFunc).join(',\n')),
        '],',
        '',
        'peg$bytecode = [',
           indent2(arrays.map(ast.rules, function(rule) {
             return 'peg$decode("'
                   + js.stringEscape(arrays.map(
                       rule.bytecode,
                         function(b) { 
                           return String.fromCharCode(b + 32); 
                         }
                     ).join(''))
                   + '")';
           }).join(',\n')),
        '],',
        '//} Tables'
      ].join('\n');
    } else {
      return arrays.map(
        ast.consts,
        function(c, i) { 
          return 'peg$c' + i + ' = ' + c + ','; 
        }
      ).concat('', arrays.map(
        ast.actions,
        function(c, i) { 
          return 'peg$f' + i + ' = ' + createFunc(c) + ','; 
        }
      )).join('\n');
    }
  }

  function runTimeStatistics(codeArray) {
    if (options.collectRunTimeStatistics) {
      return codeArray;
    }
    return false;
  }

  function generateCacheHeader(ruleIndexCode) {
    return arrays.merge([
      'var peg$cacheKey = peg$currPos * ' + ast.rules.length + ' + ' + ruleIndexCode + ',',
      '    peg$cached   = peg$cache[peg$cacheKey];',
      '',
      'if (peg$cached) {',
      '  peg$currPos = peg$cached.nextPos;',
    ], runTimeStatistics([
      '  peg$statisticsRef.cacheHit++;'
    ]), [
      '  return peg$cached.result;',
      '}',
      ''
    ]).join('\n');
  }

  function generateCacheFooter(resultCode) {
    var stmts = [
      '',
      'peg$cache[peg$cacheKey] = { nextPos: peg$currPos, result: ' + resultCode + ' };'
    ];
    return stmts.join('\n');
  }

  function generateInterpreter() {
    var parts = [];

    function generateCondition(cond, argsLength) {
      var baseLength      = argsLength + 3,
          thenLengthCode = 'bc[ip + ' + (baseLength - 2) + ']',
          elseLengthCode = 'bc[ip + ' + (baseLength - 1) + ']';

      return [
        'ends.push(end);',
        'ips.push(ip + ' + baseLength + ' + ' + thenLengthCode + ' + ' + elseLengthCode + ');',
        '',
        'if (' + cond + ') {',
        '  end = ip + ' + baseLength + ' + ' + thenLengthCode + ';',
        '  ip += ' + baseLength + ';',
        '} else {',
        '  end = ip + ' + baseLength + ' + ' + thenLengthCode + ' + ' + elseLengthCode + ';',
        '  ip += ' + baseLength + ' + ' + thenLengthCode + ';',
        '}',
        '',
        'break;'
      ].join('\n');
    }

    function generateLoop(cond) {
      var baseLength     = 2,
          bodyLengthCode = 'bc[ip + ' + (baseLength - 1) + ']';

      return [
        'if (' + cond + ') {',
        '  ends.push(end);',
        '  ips.push(ip);',
        '',
        '  end = ip + ' + baseLength + ' + ' + bodyLengthCode + ';',
        '  ip += ' + baseLength + ';',
        '} else {',
        '  ip += ' + baseLength + ' + ' + bodyLengthCode + ';',
        '}',
        '',
        'break;'
      ].join('\n');
    }

    function generateCall() {
      var baseLength       = 4,
          paramsLengthCode = 'bc[ip + ' + (baseLength - 1) + ']';

      return [
        'params = bc.slice(ip + ' + baseLength + ', ip + ' + baseLength + ' + ' + paramsLengthCode + ');',
        'for (i = 0; i < ' + paramsLengthCode + '; i++) {',
        '  params[i] = stack[stack.length - 1 - params[i]];',
        '}',
        '',
        'stack.splice(',
        '  stack.length - bc[ip + 2],',
        '  bc[ip + 2],',
        '  peg$actions[bc[ip + 1]].apply(null, params)',
        ');',
        '',
        'ip += ' + baseLength + ' + ' + paramsLengthCode + ';',
        'break;'
      ].join('\n');
    }

    parts.push(arrays.merge([
      'function peg$decode(s) {',
      '  var bc = new Array(s.length), i;',
      '',
      '  for (i = 0; i < s.length; i++) {',
      '    bc[i] = s.charCodeAt(i) - 32;',
      '  }',
      '',
      '  return bc;',
      '}',
      '',
      'function peg$parseRule(index, peg$parentRuleIndex) {',
      '  var bc    = peg$bytecode[index],',// rule bytecode
      '      ip    = 0,',   // instruction pointer
      '      ips   = [],',  // stack of instruction pointers for run nested blocks
      '      end   = bc.length,',// end of current executable region of bytecode
      '      ends  = [],',  // parallel array to `ips`
      '      stack = [],',
      '      params, i;',
      ''
    ], runTimeStatistics([
      '  var peg$statisticsRef = peg$cache_use_counters[index];',
      '',
      '  peg$statisticsRef.visit++;',
      '  peg$statisticsRef.visitingParent[peg$parentRuleIndex]++;',
      ''
    ])
    ).join('\n'));

    if (options.cache) {
      parts.push(indent2(generateCacheHeader('index')));
    }
    //{
    parts.push(arrays.merge([
      /*
       * The point of the outer loop and the |ips| & |ends| stacks is to avoid
       * recursive calls for interpreting parts of bytecode. In other words, we
       * implement the |interpret| operation of the abstract machine without
       * function calls. Such calls would likely slow the parser down and more
       * importantly cause stack overflows for complex grammars.
       */
      '  while (true) {',
      '    while (ip < end) {',
      '      switch (bc[ip]) {',
      '        case ' + op.PUSH + ':',               // PUSH c
      '          stack.push(peg$consts[bc[ip + 1]]);',
      '          ip += 2;',
      '          break;',
      '',
      '        case ' + op.PUSH_UNDEFINED + ':',     // PUSH_UNDEFINED
      '          stack.push(void 0);',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.PUSH_NULL + ':',          // PUSH_NULL
      '          stack.push(null);',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.PUSH_FAILED + ':',        // PUSH_FAILED
      '          stack.push(peg$FAILED);',
    ], runTimeStatistics([
      '          peg$statisticsRef.pushedFail++;',
    ]), [
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.PUSH_EMPTY_ARRAY + ':',   // PUSH_EMPTY_ARRAY
      '          stack.push([]);',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.PUSH_CURR_POS + ':',      // PUSH_CURR_POS
      '          stack.push(peg$currPos);',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.POP + ':',                // POP
      '          stack.pop();',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.POP_CURR_POS + ':',       // POP_CURR_POS
      '          peg$currPos = stack.pop();',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.POP_N + ':',              // POP_N n
      '          stack.length -= bc[ip + 1];',
      '          ip += 2;',
      '          break;',
      '',
      '        case ' + op.NIP + ':',                // NIP
      '          stack.splice(-2, 1);',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.APPEND + ':',             // APPEND
      '          stack[stack.length - 2].push(stack.pop());',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.WRAP + ':',               // WRAP n
      '          stack.push(stack.splice(stack.length - bc[ip + 1], bc[ip + 1]));',
      '          ip += 2;',
      '          break;',
      '',
      '        case ' + op.TEXT + ':',               // TEXT
      '          stack.push(input.substring(stack.pop(), peg$currPos));',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.IF + ':',                 // IF t, f
                 indent10(generateCondition('stack[stack.length - 1]', 0)),
      '',
      '        case ' + op.IF_ERROR + ':',           // IF_ERROR t, f
                 indent10(generateCondition(
                   'stack[stack.length - 1] === peg$FAILED',
                   0
                 )),
      '',
      '        case ' + op.IF_NOT_ERROR + ':',       // IF_NOT_ERROR t, f
                 indent10(
                   generateCondition('stack[stack.length - 1] !== peg$FAILED',
                   0
                 )),
      '',
      '        case ' + op.IF_ARRLEN_MIN + ':',       // IF_ARRLEN_MIN min, t, f
                 indent10(
                   generateCondition('stack[stack.length - 1].length < bc[ip + 1]',
                   1
                 )),
      '',
      '        case ' + op.IF_ARRLEN_MAX + ':',       // IF_ARRLEN_MAX max, t, f
                 indent10(
                   generateCondition('stack[stack.length - 1].length >= bc[ip + 1]',
                   1
                 )),
      '',
      '        case ' + op.WHILE_NOT_ERROR + ':',    // WHILE_NOT_ERROR b
                 indent10(generateLoop('stack[stack.length - 1] !== peg$FAILED')),
      '',
      '        case ' + op.MATCH_ANY + ':',          // MATCH_ANY a, f, ...
                 indent10(generateCondition('input.length > peg$currPos', 0)),
      '',
      '        case ' + op.MATCH_STRING + ':',       // MATCH_STRING s, a, f, ...
                 indent10(generateCondition(
                   'input.substr(peg$currPos, peg$consts[bc[ip + 1]].length) === peg$consts[bc[ip + 1]]',
                   1
                 )),
      '',
      '        case ' + op.MATCH_STRING_IC + ':',    // MATCH_STRING_IC s, a, f, ...
                 indent10(generateCondition(
                   'input.substr(peg$currPos, peg$consts[bc[ip + 1]].length).toLowerCase() === peg$consts[bc[ip + 1]]',
                   1
                 )),
      '',
      '        case ' + op.MATCH_REGEXP + ':',       // MATCH_REGEXP r, a, f, ...
                 indent10(generateCondition(
                   'peg$consts[bc[ip + 1]].test(input.charAt(peg$currPos))',
                   1
                 )),
      '',
      '        case ' + op.ACCEPT_N + ':',           // ACCEPT_N n
      '          stack.push(input.substr(peg$currPos, bc[ip + 1]));',
      '          peg$currPos += bc[ip + 1];',
      '          ip += 2;',
      '          break;',
      '',
      '        case ' + op.ACCEPT_STRING + ':',      // ACCEPT_STRING s
      '          stack.push(peg$consts[bc[ip + 1]]);',
      '          peg$currPos += peg$consts[bc[ip + 1]].length;',
      '          ip += 2;',
      '          break;',
      '',
      '        case ' + op.FAIL + ':',               // FAIL e
      '          stack.push(peg$FAILED);',
    ], runTimeStatistics([
      '          peg$statisticsRef.fail++;',
      '          peg$statisticsRef.silentFail++;',
    ]), [
      '          if (peg$silentFails === 0) {',
    ], runTimeStatistics([
      '            peg$statisticsRef.silentFail--;',
    ]), [
      '            peg$fail(peg$consts[bc[ip + 1]], index);',
      '          }',
      '          ip += 2;',
      '          break;',
      '',
      '        case ' + op.REPORT_SAVED_POS + ':',   // REPORT_SAVED_POS p
      '          peg$reportedPos = stack[stack.length - 1 - bc[ip + 1]];',
      '          ip += 2;',
      '          break;',
      '',
      '        case ' + op.REPORT_CURR_POS + ':',    // REPORT_CURR_POS
      '          peg$reportedPos = peg$currPos;',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.CALL + ':',               // CALL f, n, pc, p1, p2, ..., pN
                 indent10(generateCall()),
      '',
      '        case ' + op.RULE + ':',               // RULE r
      '          stack.push(peg$parseRule(bc[ip + 1], index));',
      '          ip += 2;',
      '          break;',
      '',
      '        case ' + op.SILENT_FAILS_ON + ':',    // SILENT_FAILS_ON
      '          peg$silentFails++;',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.SILENT_FAILS_OFF + ':',   // SILENT_FAILS_OFF
      '          peg$silentFails--;',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.SILENT_FAILS_RESET + ':',   // SILENT_FAILS_RESET
      '          peg$silentFails = 0;',
      '          ip++;',
      '          break;',
      '',
      '        case ' + op.IF_ARRLEN_MIN + ':',      // IF_ARRLEN_MIN t f
      '          i = stack.pop();',
                 indent10(generateCondition('typeof(i) !== "undefined" && stack[stack.length - 1].length < i', 0)),
      '',
      '        case ' + op.IF_ARRLEN_MAX + ':',      // IF_ARRLEN_MAX t f
      '          i = stack.pop();',
                 indent10(generateCondition('typeof(i) !== "undefined" && stack[stack.length - 1].length >= i', 0)),
      '',
      '        default:',
      '          throw new Error("Invalid opcode: " + bc[ip] + ".");',
      '      }',
      '    }',
      '',
      '    if (ends.length > 0) {',
      '      end = ends.pop();',
      '      ip = ips.pop();',
      '    } else {',
      '      break;',
      '    }',
      '  }'
    ]).join('\n'));//}

    if (options.cache) {
      parts.push(indent2(generateCacheFooter('stack[0]')));
    }

    parts.push([
      '',
      '  return stack[0];',
      '}'
    ].join('\n'));

    return parts.join('\n');
  }

  // Output an AST constant as a JavaScript comment in a string, 
  // to serve as part of the documenting comments of the generated parser.
  function const2comment(i) {
    if (i === +i && ast.consts[i]) {
      var s = '' + ast.consts[i];
      s = s.replace(/\/\*|\*\//g, '**').replace(/[ \t\r\n\v]/g, ' ');
      if (s.length > 0) {
        return ' /* ' + s + ' */ ';
      }
    }
    return '';
  }

  function generateRuleFunction(rule) {
    var parts = [], code;

    function c(i) { return 'peg$c' + i + const2comment(i); } // |consts[i]| of the abstract machine
    function f(i) { return 'peg$f' + i; } // |actions[i]| of the abstract machine
    function s(i) { return 's'     + i; } // |stack[i]| of the abstract machine

    var stack = {
          sp:    -1,
          maxSp: -1,

          push: function(exprCode) {
            var code = s(++this.sp) + ' = ' + exprCode + ';';

            if (this.sp > this.maxSp) { 
              this.maxSp = this.sp; 
            }

            return code;
          },

          pop: function() {
            var n, values;

            if (arguments.length === 0) {
              return s(this.sp--);
            } else {
              n = arguments[0];
              values = arrays.map(arrays.range(this.sp - n + 1, this.sp + 1), s);
              this.sp -= n;

              return values;
            }
          },

          top: function() {
            return s(this.sp);
          },

          index: function(i) {
            return s(this.sp - i);
          }
        };

    function compile(bc) {
      var ip    = 0,
          end   = bc.length,
          parts = [],
          value;

      function compileCondition(cond, argCount) {
        var baseLength = argCount + 3,
            thenLength = bc[ip + baseLength - 2],
            elseLength = bc[ip + baseLength - 1],
            baseSp     = stack.sp,
            thenCode, elseCode, thenSp, elseSp;

        ip += baseLength;
        thenCode = compile(bc.slice(ip, ip + thenLength));
        thenSp = stack.sp;
        ip += thenLength;

        if (elseLength > 0) {
          stack.sp = baseSp;
          elseCode = compile(bc.slice(ip, ip + elseLength));
          elseSp = stack.sp;
          ip += elseLength;

          if (thenSp !== elseSp) {
            throw new Error(
              "Branches of a condition must move the stack pointer in the same way. (" + thenSp + " != " + elseSp + ")"
            );
          }
        }

        parts.push('if (' + cond + ') {');
        parts.push(indent2(thenCode));
        if (elseLength > 0) {
          parts.push('} else {');
          parts.push(indent2(elseCode));
        }
        parts.push('}');
      }

      function compileLoop(cond) {
        var baseLength = 2,
            bodyLength = bc[ip + baseLength - 1],
            baseSp     = stack.sp,
            bodyCode, bodySp;

        ip += baseLength;
        bodyCode = compile(bc.slice(ip, ip + bodyLength));
        bodySp = stack.sp;
        ip += bodyLength;

        if (bodySp !== baseSp) {
          throw new Error("Body of a loop can't move the stack pointer.");
        }

        parts.push('while (' + cond + ') {');
        parts.push(indent2(bodyCode));
        parts.push('}');
      }

      function compileCall() {
        var baseLength   = 4,
            paramsLength = bc[ip + baseLength - 1];

        var value = f(bc[ip + 1]) + '('
              + arrays.map(
                  bc.slice(ip + baseLength, ip + baseLength + paramsLength),
                  function(p) { 
                    return stack.index(p); 
                  }
                ).join(', ')
              + ')';
        stack.pop(bc[ip + 2]);
        parts.push(stack.push(value));
        ip += baseLength + paramsLength;
      }

      while (ip < end) {
        switch (bc[ip]) {
          case op.PUSH:               // PUSH c
            parts.push(stack.push(c(bc[ip + 1])));
            ip += 2;
            break;

          case op.PUSH_CURR_POS:      // PUSH_CURR_POS
            parts.push(stack.push('peg$currPos'));
            ip++;
            break;

          case op.PUSH_UNDEFINED:     // PUSH_UNDEFINED
            parts.push(stack.push('void 0'));
            ip++;
            break;

          case op.PUSH_NULL:          // PUSH_NULL
            parts.push(stack.push('null'));
            ip++;
            break;

          case op.PUSH_FAILED:        // PUSH_FAILED
            parts.push(stack.push('peg$FAILED'));
            if (options.collectRunTimeStatistics) {
              parts.push('peg$statisticsRef.pushedFail++;');
            }
            ip++;
            break;

          case op.PUSH_EMPTY_ARRAY:   // PUSH_EMPTY_ARRAY
            parts.push(stack.push('[]'));
            ip++;
            break;

          case op.POP:                // POP
            stack.pop();
            ip++;
            break;

          case op.POP_CURR_POS:       // POP_CURR_POS
            parts.push('peg$currPos = ' + stack.pop() + ';');
            ip++;
            break;

          case op.POP_N:              // POP_N n
            stack.pop(bc[ip + 1]);
            ip += 2;
            break;

          case op.NIP:                // NIP
            value = stack.pop();
            stack.pop();
            parts.push(stack.push(value));
            ip++;
            break;

          case op.APPEND:             // APPEND
            value = stack.pop();
            parts.push(stack.top() + '.push(' + value + ');');
            ip++;
            break;

          case op.WRAP:               // WRAP n
            parts.push(
              stack.push('[' + stack.pop(bc[ip + 1]).join(', ') + ']')
            );
            ip += 2;
            break;

          case op.TEXT:               // TEXT
            parts.push(
              stack.push('input.substring(' + stack.pop() + ', peg$currPos)')
            );
            ip++;
            break;

          case op.IF:                 // IF t, f
            compileCondition(stack.top(), 0);
            break;

          case op.IF_ERROR:           // IF_ERROR t, f
            compileCondition(stack.top() + ' === peg$FAILED', 0);
            break;

          case op.IF_NOT_ERROR:       // IF_NOT_ERROR t, f
            compileCondition(stack.top() + ' !== peg$FAILED', 0);
            break;

          case op.IF_ARRLEN_MIN:      // IF_ARRLEN_MIN min, t, f
            compileCondition(stack.top() + '.length < ' + bc[ip + 1], 1);
            break;

          case op.IF_ARRLEN_MAX:      // IF_ARRLEN_MAX max, t, f
            compileCondition(stack.top() + '.length >= ' + bc[ip + 1], 1);
            break;

          case op.WHILE_NOT_ERROR:    // WHILE_NOT_ERROR b
            compileLoop(stack.top() + ' !== peg$FAILED', 0);
            break;

          case op.MATCH_ANY:          // MATCH_ANY a, f, ...
            compileCondition('input.length > peg$currPos', 0);
            break;

          case op.MATCH_STRING:       // MATCH_STRING s, a, f, ...
            compileCondition(
              eval(ast.consts[bc[ip + 1]]).length > 1
                ? 'input.substr(peg$currPos, '
                    + eval(ast.consts[bc[ip + 1]]).length
                    + ') === '
                    + c(bc[ip + 1])
                : 'input.charCodeAt(peg$currPos) === '
                    + eval(ast.consts[bc[ip + 1]]).charCodeAt(0),
              1
            );
            break;

          case op.MATCH_STRING_IC:    // MATCH_STRING_IC s, a, f, ...
            compileCondition(
              'input.substr(peg$currPos, '
                + eval(ast.consts[bc[ip + 1]]).length
                + ').toLowerCase() === '
                + c(bc[ip + 1]),
              1
            );
            break;

          case op.MATCH_REGEXP:       // MATCH_REGEXP r, a, f, ...
            compileCondition(
              c(bc[ip + 1]) + '.test(input.charAt(peg$currPos))',
              1
            );
            break;

          case op.ACCEPT_N:           // ACCEPT_N n
            parts.push(stack.push(
              bc[ip + 1] > 1
                ? 'input.substr(peg$currPos, ' + bc[ip + 1] + ')'
                : 'input.charAt(peg$currPos)'
            ));
            parts.push(
              bc[ip + 1] > 1
                ? 'peg$currPos += ' + bc[ip + 1] + ';'
                : 'peg$currPos++;'
            );
            ip += 2;
            break;

          case op.ACCEPT_STRING:      // ACCEPT_STRING s
            parts.push(stack.push(c(bc[ip + 1])));
            parts.push(
              eval(ast.consts[bc[ip + 1]]).length > 1
                ? 'peg$currPos += ' + eval(ast.consts[bc[ip + 1]]).length + ';'
                : 'peg$currPos++;'
            );
            ip += 2;
            break;

          case op.FAIL:               // FAIL e
            parts.push(stack.push('peg$FAILED'));
            if (options.collectRunTimeStatistics) {
              parts.push('peg$statisticsRef.fail++;');
              parts.push('peg$statisticsRef.silentFail++;');
            }
            parts.push('if (peg$silentFails === 0) {');
            if (options.collectRunTimeStatistics) {
              parts.push('  peg$statisticsRef.silentFail--;');
            }
            parts.push('  peg$fail(' + c(bc[ip + 1]) + ', peg$currentRuleIndex);');
            parts.push('}');
            ip += 2;
            break;

          case op.REPORT_SAVED_POS:   // REPORT_SAVED_POS p
            parts.push('peg$reportedPos = ' + stack.index(bc[ip + 1]) + ';');
            parts.push('peg$currentRule = peg$currentRuleIndex;');
            ip += 2;
            break;

          case op.REPORT_CURR_POS:    // REPORT_CURR_POS
            parts.push('peg$reportedPos = peg$currPos;');
            ip++;
            break;

          case op.CALL:               // CALL f, n, pc, p1, p2, ..., pN
            compileCall();
            break;

          case op.RULE:               // RULE r
            if (!ast.rules[bc[ip + 1]]) {
              console.log("RULE REF: ", ip + 1, bc[ip + 1]);
            }
            parts.push(stack.push("peg$parse" + ast.rules[bc[ip + 1]].name + "(peg$currentRuleIndex)"));
            ip += 2;
            break;

          case op.SILENT_FAILS_ON:    // SILENT_FAILS_ON
            parts.push('peg$silentFails++;');
            ip++;
            break;

          case op.SILENT_FAILS_OFF:   // SILENT_FAILS_OFF
            parts.push('peg$silentFails--;');
            ip++;
            break;

          case op.SILENT_FAILS_RESET:    // SILENT_FAILS_RESET
            parts.push('peg$silentFails = 0;');
            ip++;
            break;

          case op.IF_ARRLEN_MIN:    // IF_ARRLEN_MIN t f
            value = stack.pop();
            compileCondition('typeof(' + value + ') !== "undefined" && ' + stack.top() + '.length < ' + value, 0);
            break;

          case op.IF_ARRLEN_MAX:    // IF_ARRLEN_MAX t f
            value = stack.pop();
            compileCondition('typeof(' + value + ') !== "undefined" && ' + stack.top() + '.length >= ' + value, 0);
            break;

          default:
            throw new Error("Invalid opcode: " + getOpcodeName(bc[ip]) + ".");
        }
      }

      return parts.join('\n');
    }

    code = compile(rule.bytecode);

    var rawRuleText = rule.rawText;
    if (rawRuleText) {
      rawRuleText = rawRuleText.replace(/\/\*/gm, '{#').replace(/\*\//gm, '#}').replace(/\n/gm, '\n * ');
    } else {
      rawRuleText = false;
    }
    parts.push(arrays.merge([
      (rawRuleText ? '/*\n * ' + rawRuleText + '\n */' : ''),
      'function peg$parse' + rule.name + '(peg$parentRuleIndex) {',
      '  var peg$currentRuleIndex = ' + asts.indexOfRule(ast, rule.name) + ';',
      '  var ' + arrays.map(arrays.range(0, stack.maxSp + 1), s).join(', ') + ';',
      ''
    ], runTimeStatistics([
      '  var peg$statisticsRef = peg$cache_use_counters[peg$currentRuleIndex];',
      '',
      '  peg$statisticsRef.visit++;',
      '  peg$statisticsRef.visitingParent[peg$parentRuleIndex]++;',
      ''
    ])
    ).join('\n'));

    var hasNoCacheAnnotation = asts.findAnnotation(rule, "nocache");
    
    if (options.cache && !hasNoCacheAnnotation) {
      parts.push(indent2(
        generateCacheHeader(asts.indexOfRule(ast, rule.name))
      ));
    }

    parts.push(indent2(code));

    if (options.cache && !hasNoCacheAnnotation) {
      parts.push(indent2(generateCacheFooter(s(0))));
    }

    parts.push([
      '',
      '  return ' + s(0) + ';',
      '}'
    ].join('\n'));

    return parts.join('\n');
  }

  var parts = [],
      startRuleIndices,   startRuleIndex,
      startRuleFunctions, startRuleFunction;


  // scan the grammar for annotations which affect all rules and/or influence the options...
  var anno_names = ['cache', 'nocache'];
  // we don't care how many times a global cache(all) or cache(none) was specified: the first one wins.
  var has_cacheAllNone = arrays.find(ast.rules, function (r) {
    var a = arrays.find(r.annotations, function (a, i) {
      if (anno_names.indexOf(a.name) >= 0) {
        var params = a.params || [];
        return params.indexOf('all') > 0 || params.indexOf('none') > 0;
      }
      return false;
    }); 
    return !!a;
  });
  var caching = options.cache;
  if (has_cacheAllNone) {
    has_cacheAllNone = arrays.find(has_cacheAllNone.annotations, function (a) { return anno_names.indexOf(a.name) >= 0; });
    var param = arrays.find(has_cacheAllNone.params, function (a) { return a === 'all' || a === 'none'; });
    param = (param === 'none');
    if (has_cacheAllNone.name === 'nocache') {
      caching = false ^ param;
    } else {
      caching = true ^ param;
    }
  }
  // and now make sure every rule has a cache or nocache attribute assigned:
  asts.globalApplyAnnotationConditionally(ast.rules, {
    type: 'annotation',
    name: caching ? 'cache' : 'nocache',
    params: []
  }, anno_names);

  // now we go and check if ANY rule has the `cache` annotation, because when one (or more) has it, we need to enable caching whether we like it or not:
  if (asts.globalFindAnnotations(ast.rules, 'cache')) {
    options.cache = 1;
  }

  // and also see whether we have a `@collect_statistics` annotation somewhere...
  if (asts.globalFindAnnotations(ast.rules, 'collect_statistics')) {
    options.collectRunTimeStatistics = 1;
  }


  parts.push([
    '(function(global) {',
    '  /*',
    '   * Generated by PEG.js 0.8.0.',
    '   *',
    '   * http://pegjs.majda.cz/',
    '   */',
    '',
    '  function peg$subclass(child, parent) {',
    '    function ctor() { this.constructor = child; }',
    '    ctor.prototype = parent.prototype;',
    '    child.prototype = new ctor();',
    '  }',
    '',
    '  function peg$SyntaxError(message, expected, found, offset, line, column) {',
    '    this.message  = message;',
    '    this.expected = expected;',
    '    this.found    = found;',
    '    this.offset   = offset;',
    '    this.line     = line;',
    '    this.column   = column;',
    '',
    '    this.name     = "SyntaxError";',
    '  }',
    '',
    '  peg$subclass(peg$SyntaxError, Error);',
    ''
  ].join('\n'));

  if (options.collectRunTimeStatistics || options.includeRuleNames) {
    parts.push('  var peg$index2rule_name = [');
    arrays.each(ast.rules, function(rule, index) {
      parts.push('        "' + rule.name + '",             // index: ' + index);
    });
    parts.push([
      '      ];',
      '',
      '  function peg$getRuleNamesIndexTable() {',
      '    return peg$index2rule_name;',
      '  }',
      ''
    ].join('\n'));
  }

  if (options.collectRunTimeStatistics) {
    parts.push([
      '  var peg$cache_use_counters = new Array(' + ast.rules.length + ');',
      '',
      '  function peg$getStatistics(reset) {',
      '    var rv = {',
      '      counters: peg$cache_use_counters.slice(0),',
      '      rulenames: peg$index2rule_name,',
      '    };',
      '',
      '    if (reset) {',
      '      var i, len;',
      '      var parents = new Array(' + ast.rules.length + ');',
      '      for (i = 0, len = parents.length; i < len; i++) {',
      '        parents[i] = 0;',
      '      }',
      '      for (var i = 0, len = peg$cache_use_counters.length; i < len; i++) {',
      '        peg$cache_use_counters[i] = {',
      '          visit: 0,',
      '          visitingParent: parents.slice(0),',      // clone the parents[] array for each rule instance
      '          cacheHit: 0,',
      '          fail: 0,',
      '          silentFail: 0,',
      '          pushedFail: 0,',
      '        };',
      '      }',
      '    }',
      '    return rv;',
      '  }',
      '',
      '  peg$getStatistics(true);',         // quickest & cleanest way to *init* the statistics structure 
      '',
    ].join('\n'));
  }

  parts.push([
    '  function peg$parse(input) {',
    '    var options = arguments.length > 1 ? arguments[1] : {},',
    '        parser  = this,',
    '',
    '        peg$FAILED = {},',
    ''
  ].join('\n'));

  if (options.optimize === "size") {
    startRuleIndices = '{ '
                     + arrays.map(
                         options.allowedStartRules,
                         function(r) { 
                           return r + ': ' + asts.indexOfRule(ast, r); 
                         }
                       ).join(', ')
                     + ' }';
    startRuleIndex = asts.indexOfRule(ast, options.allowedStartRules[0]);

    parts.push([
      '        peg$startRuleIndices = ' + startRuleIndices + ',',
      '        peg$startRuleIndex   = ' + startRuleIndex + ','
    ].join('\n'));
  } else {
    startRuleFunctions = '{ '
                     + arrays.map(
                         options.allowedStartRules,
                         function(r) { 
                           return r + ': peg$parse' + r; 
                         }
                       ).join(', ')
                     + ' }';
    startRuleFunction = 'peg$parse' + options.allowedStartRules[0];

    parts.push([
      '        peg$startRuleFunctions = ' + startRuleFunctions + ',',
      '        peg$startRuleFunction  = ' + startRuleFunction + ','
    ].join('\n'));
  }

  parts.push('');

  parts.push(indent8(generateTables()));

  parts.push([
    '',
    '        peg$currPos          = 0,',
    '        peg$reportedPos      = 0,',
    '        peg$cachedPos        = 0,',
    '        peg$cachedPosDetails = { line: 1, column: 1, seenCR: false },',
    '        peg$maxFailPos       = 0,',
    '        peg$maxFailExpected  = [],',
    '        peg$silentFails      = 0,     // 0 = report failures, > 0 = silence failures',
    '        peg$currentRule      = null,  // null or a number representing the rule; the latter is an index into the peg$index2rule_name[] rule name array',
    ''
  ].join('\n'));

  if (options.cache) {
    parts.push('        peg$cache = {},');
  }

  parts.push([
    '        peg$result;',
    ''
  ].join('\n'));

  if (options.optimize === "size") {
    parts.push([
      '    if ("startRule" in options) {',
      '      if (!(options.startRule in peg$startRuleIndices)) {',
      '        throw new Error("Can\'t start parsing from rule \\"" + options.startRule + "\\".");',
      '      }',
      '',
      '      peg$startRuleIndex = peg$startRuleIndices[options.startRule];',
      '    }'
    ].join('\n'));
  } else {
    parts.push([
      '    if ("startRule" in options) {',
      '      if (!(options.startRule in peg$startRuleFunctions)) {',
      '        throw new Error("Can\'t start parsing from rule \\"" + options.startRule + "\\".");',
      '      }',
      '',
      '      peg$startRuleFunction = peg$startRuleFunctions[options.startRule];',
      '    }'
    ].join('\n'));
  }

  parts.push([
    '    //{ Helper functions',
    '    function text() {',
    '      return input.substring(peg$reportedPos, peg$currPos);',
    '    }',
    '',
    '    function ruleIndex() {',
    '      return peg$currentRule;',
    '    }',
    '',
    '    function ruleName(index) {',
    '      index = (index == null ? peg$currentRule : index);',
    '      return index !== null ? (peg$index2rule_name[index] || null) : null;',
    '    }',
    '',
    '    function region(withText) {',
    '      var e = peg$computePosDetails(peg$currPos);',
    '      var b = peg$computePosDetails(peg$reportedPos);',
    '      var result = {',
    '        begin: {offset: peg$reportedPos, line: b.line, column: b.column},',
    '        end:   {offset: peg$currPos,     line: e.line, column: e.column}',
    '      };',
    '      if (withText) {',
    '        result.text = text();',
    '      }',
    '      return result;',
    '    }',
    '',
    '    function offset() {',
    '      return peg$reportedPos;',
    '    }',
    '',
    '    function line() {',
    '      return peg$computePosDetails(peg$reportedPos).line;',
    '    }',
    '',
    '    function column() {',
    '      return peg$computePosDetails(peg$reportedPos).column;',
    '    }',
    '',
    '    function expected(description) {',
    '      throw peg$buildException(',
    '        null,',
    '        [{ type: "other", description: description }],',
    '        peg$reportedPos',
    '      );',
    '    }',
    '',
    '    function error(message) {',
    '      throw peg$buildException(message, null, peg$reportedPos);',
    '    }',
    '',
    '    function peg$computePosDetails(pos) {',
    '      function advance(details, startPos, endPos) {',
    '        var p, ch;',
    '',
    '        for (p = startPos; p < endPos; p++) {',
    '          ch = input.charAt(p);',
    '          if (ch === "\\n") {',
    '            if (!details.seenCR) { details.line++; }',
    '            details.column = 1;',
    '            details.seenCR = false;',
    '          } else if (ch === "\\r" || ch === "\\u2028" || ch === "\\u2029") {',
    '            details.line++;',
    '            details.column = 1;',
    '            details.seenCR = true;',
    '          } else {',
    '            details.column++;',
    '            details.seenCR = false;',
    '          }',
    '        }',
    '      }',
    '',
    '      if (peg$cachedPos !== pos) {',
    '        if (peg$cachedPos > pos) {',
    '          peg$cachedPos = 0;',
    '          peg$cachedPosDetails = { line: 1, column: 1, seenCR: false };',
    '        }',
    '        advance(peg$cachedPosDetails, peg$cachedPos, pos);',
    '        peg$cachedPos = pos;',
    '      }',
    '',
    '      return peg$cachedPosDetails;',
    '    }',
    '',
    '    function peg$fail(expected, ruleIndex) {',
    '      if (peg$currPos < peg$maxFailPos) { return; }',
    '',
    '      if (peg$currPos > peg$maxFailPos) {',
    '        peg$maxFailPos = peg$currPos;',
    '        peg$maxFailExpected = [];',
    '      }',
    '',
    '      peg$maxFailExpected.push(expected);',
    '    }',
    '',
    '    function peg$buildException(message, expected, pos) {',
    '      function cleanupExpected(expected) {',
    '        var i = 1;',
    '',
    '        expected.sort(function(a, b) {',
    '          if (a.description < b.description) {',
    '            return -1;',
    '          } else if (a.description > b.description) {',
    '            return 1;',
    '          } else {',
    '            return 0;',
    '          }',
    '        });',
    '',
    /*
     * This works because the bytecode generator guarantees that every
     * expectation object exists only once, so it's enough to use |===| instead
     * of deeper structural comparison.
     */
    '        while (i < expected.length) {',
    '          if (expected[i - 1] === expected[i]) {',
    '            expected.splice(i, 1);',
    '          } else {',
    '            i++;',
    '          }',
    '        }',
    '      }',
    '',
    '      function buildMessage(expected, found) {',
    '        function stringEscape(s) {',
    '          function hex(ch) {',
    '            return ch.charCodeAt(0).toString(16).toUpperCase();',
    '          }',
    '',
    /*
     * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a string
     * literal except for the closing quote character, backslash, carriage
     * return, line separator, paragraph separator, and line feed. Any character
     * may appear in the form of an escape sequence.
     *
     * For portability, we also escape all control and non-ASCII characters.
     * Note that "\0" and "\v" escape sequences are not used because JSHint does
     * not like the first and IE the second.
     */
    '          return s',
    '            .replace(/\\\\/g,   \'\\\\\\\\\')',   // backslash
    '            .replace(/"/g,    \'\\\\"\')',        // closing double quote
    '            .replace(/\\x08/g, \'\\\\b\')',       // backspace
    '            .replace(/\\t/g,   \'\\\\t\')',       // horizontal tab
    '            .replace(/\\n/g,   \'\\\\n\')',       // line feed
    '            .replace(/\\f/g,   \'\\\\f\')',       // form feed
    '            .replace(/\\r/g,   \'\\\\r\')',       // carriage return
    '            .replace(/[\\x00-\\x07\\x0B\\x0E\\x0F]/g, function(ch) { return \'\\\\x0\' + hex(ch); })',
    '            .replace(/[\\x10-\\x1F\\x80-\\xFF]/g,    function(ch) { return \'\\\\x\'  + hex(ch); })',
    '            .replace(/[\\u0100-\\u0FFF]/g,         function(ch) { return \'\\\\u0\' + hex(ch); })',
    '            .replace(/[\\u1000-\\uFFFF]/g,         function(ch) { return \'\\\\u\'  + hex(ch); });',
    '        }',
    '',
    '        var expectedDescs = new Array(expected.length),',
    '            expectedDesc, foundDesc, i;',
    '',
    '        for (i = 0; i < expected.length; i++) {',
    '          expectedDescs[i] = expected[i].description;',
    '        }',
    '',
    '        expectedDesc = expected.length > 1',
    '          ? expectedDescs.slice(0, -1).join(", ")',
    '              + " or "',
    '              + expectedDescs[expected.length - 1]',
    '          : expectedDescs[0];',
    '',
    '        foundDesc = found.length ? "\\"" + stringEscape(found) + "\\"" : "end of input";',
    '',
    '        return "Expected " + expectedDesc + " but " + foundDesc + " found.";',
    '      }',
    '',
    '      var posDetails = peg$computePosDetails(pos),',
    '          found;',
    '',
    '      if (pos < input.length) {',
    '        found = input.charAt(pos);',
    '',
    '        // Heuristics: grab one word or non-word at the error location to help the diagnostics.',
    '        // Limit the extracted content to 17 characters, anything longer gets an ellipsis at the end.',
    '        // And: also including leading whitespace.',
    '        var inputRemainder = input.substr(pos);',
    '        var extractedWord = inputRemainder.match(/^\\s*\\w+/i);',
    '        var extractedNonWord = inputRemainder.match(/^\\s*[^\\s\\w]+/i);',
    '        if (extractedWord || extractedNonWord) {',
    '          found = (extractedWord || extractedNonWord)[0].replace(/\\s+/g, " ");  // and convert TAB, CR/LF, etc. whitespace to a single space',
    '          if (found.length > 17) {',
    '            found = found.substr(0, 17) + "...";',
    '          }',
    '        }',
    '        found = inputRemainder.substr(0, 256);',
    '      } else {',
    '        found = null;',
    '      }',
    '',
    '      if (expected !== null) {',
    '        cleanupExpected(expected);',
    '      }',
    '',
    '      return new peg$SyntaxError(',
    '        message !== null ? message : buildMessage(expected, found),',
    '        expected,',
    '        found,',
    '        pos,',
    '        posDetails.line,',
    '        posDetails.column',
    '      );',
    '    }',
    '    //}'
  ].join('\n'));

  if (options.optimize === "size") {
    parts.push(indent4(generateInterpreter()));
    parts.push('');
  } else {
    parts.push('    //{ Parse rule functions');
    arrays.each(ast.rules, function(rule) {
      parts.push(indent4(generateRuleFunction(rule)));
      parts.push('');
    });
    parts.push('    //}');
  }

  if (ast.initializer) {
    parts.push(indent2(ast.initializer.code));
    parts.push('');
  }

  if (options.optimize === "size") {
    parts.push('    peg$result = peg$parseRule(peg$startRuleIndex, null);');
  } else {
    parts.push('    peg$result = peg$startRuleFunction(null);');
  }

  parts.push([
    '',
    '    if (peg$result !== peg$FAILED && peg$currPos === input.length) {',
    '      return peg$result;',
    '    } else {',
    '      if (peg$result !== peg$FAILED && peg$currPos < input.length) {',
    '        peg$fail({ type: "end", description: "end of input" }, -1);',
    '      }',
    '',
    '      throw peg$buildException(null, peg$maxFailExpected, peg$maxFailPos);',
    '    }',
    '  }',
    '',
    '  peg$result = {',
    '    SyntaxError:            peg$SyntaxError,',
    (options.collectRunTimeStatistics ? '    getStatistics:          peg$getStatistics,' : ''),
    '    getRuleNamesIndexTable: peg$getRuleNamesIndexTable,',
    '    parse:                  peg$parse',
    '  };',
    '  if (typeof define === "function" && define.amd) {',
    // AMD module
    '    define(function() {',
    '      return peg$result;',
    '    });',
    '  } else if (typeof exports === "object") {',
    // CommonJS module
    '    module.exports = peg$result;',
    '  } else if (typeof modules === "object" && typeof modules.define === "function") {',
    // PEG.js module for Web Browser
    '    module.exports = peg$result;',
    '  } else {',
    // Web Browser
    '    global.' + options.exportVar + ' = peg$result;',
    '  }',
    // for compatibility
    '  return peg$result;',
    '})(this);'
  ].join('\n'));

  ast.code = parts.join('\n');
}

module.exports = generateJavascript;
