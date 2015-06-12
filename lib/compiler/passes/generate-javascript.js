"use strict";

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

  function traceSupport(codeArray) {
    if (options.trace) {
      return codeArray;
    }
    return false;
  }

  function memoizationSupport(rule, codeArray) {
    if (options.cache && (rule ? (rule.memoized || true /* temporary hack! */) : true)) {
      return codeArray;
    }
    return false;
  }

  function generateMemoizationHeader(ruleNameCode, ruleIndexCode, rule) {
    return arrays.merge(
      traceSupport([
        'peg$tracer.trace({',
        '  type:     "rule.enter",',
        '  rule:     ' + ruleNameCode + ',',
        '  location: peg$computeLocation(startPos, startPos)',
        '});',
        ''
    ]),
    memoizationSupport(rule, arrays.merge([
      'var peg$memoizeKey = peg$currPos * ' + ast.rules.length + ' + ' + ruleIndexCode + ',',
      '    peg$memoized   = peg$memoize[peg$memoizeKey];',
      '',
      'if (peg$memoized) {',
      '  peg$currPos = peg$memoized.nextPos;',
    ], traceSupport([
      '  if (peg$memoized.result !== peg$FAILED) {',
      '    peg$tracer.trace({',
      '      type:     "rule.match.memoized",',
      '      rule:     ' + ruleNameCode + ',',
      '      result:   peg$memoized.result,',
      '      location: peg$computeLocation(startPos, peg$currPos)',
      '    });',
      '  } else {',
      '    peg$tracer.trace({',
      '      type:     "rule.fail.memoized",',
      '      rule:     ' + ruleNameCode + ',',
      '      location: peg$computeLocation(startPos, startPos)',
      '    });',
      '  }',
      ''
    ]), runTimeStatistics([
      '  peg$statisticsRef.cacheHit++;',
      '  peg$statisticsParentRef.cacheHit++;',
      '  if (peg$memoized.result === peg$FAILED) {',
      '    if (peg$silentFails) {',
      '      peg$statisticsRef.returnCachedSilentFail++;',
      '    }',
      '    peg$statisticsRef.returnCachedFail++;',
      '  }'
    ]), [
      '  return peg$memoized.result;',
      '} else {',
      // Following the [Medeiros, 2014] left recursion in PEG grammars whitepaper, we set the initial memo
      // marker to FAIL. This also fixes another issue: now the Kleene operator around epsilon also stops
      // immediately, i.e. `A = B*; B = b?;` will not crash the system by stack exhaustion any more. (The 
      // proper fix for that one is also in line with the further work required for left recursion support
      // where the WHILE opcode should abort its loop not only when the inner sequence produces a FAIL but
      // also when the inner loop does not consume any more input characters than the previous iteration.)
      '  peg$memoize[peg$memoizeKey] = { nextPos: peg$currPos, result: peg$FAILED };',
      '}',
      ''
    ]))).join('\n');
  }

  function generateMemoizationFooter(ruleNameCode, resultCode, rule) {
    return arrays.merge(memoizationSupport(rule, [
      '',
      'peg$memoize[peg$memoizeKey] = { nextPos: peg$currPos, result: ' + resultCode + ' };'
    ]), runTimeStatistics([
      '',
      'if (' + resultCode + ' === peg$FAILED) {',
      '  if (peg$silentFails) {',
      '    peg$statisticsRef.returnSilentFail++;',
      '  }',
      '  peg$statisticsRef.returnFail++;',
      '}'
    ]), traceSupport([
      '',
      'if (' + resultCode + ' !== peg$FAILED) {',
      '  peg$tracer.trace({',
      '    type:     "rule.match",',
      '    rule:     ' + ruleNameCode + ',',
      '    result:   ' + resultCode + ',',
      '    location: peg$computeLocation(startPos, peg$currPos)',
      '  });',
      '} else {',
      '  peg$tracer.trace({',
      '    type:     "rule.fail",',
      '    rule:     ' + ruleNameCode + ',',
      '    location: peg$computeLocation(startPos, startPos)',
      '  });',
      '}'
    ]), [
      '',
      'return ' + resultCode + ';'
    ]).join('\n');
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
    ], traceSupport([
      '      startPos = peg$currPos,',
    ]), [
      '      params, i;',
      ''
    ], runTimeStatistics([
      '  var peg$statisticsRef = peg$memoize_use_counters[index];',
      '  var peg$statisticsParentRef = peg$statisticsRef.visitingParent[peg$parentRuleIndex] || {};',
      '',
      '  peg$statisticsRef.visit++;',
      '  peg$statisticsParentRef.visit++;',
      ''
    ])
    ).join('\n'));

    parts.push(indent2(generateMemoizationHeader('peg$ruleNames[index]', 'index', null)));

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
      '        case ' + op.LOAD_SAVED_POS + ':',     // LOAD_SAVED_POS p
      '          peg$savedPos = stack[stack.length - 1 - bc[ip + 1]];',
      '          ip += 2;',
      '          break;',
      '',
      '        case ' + op.UPDATE_SAVED_POS + ':',   // UPDATE_SAVED_POS
      '          peg$savedPos = peg$currPos;',
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

    parts.push(indent2(generateMemoizationFooter('peg$ruleNames[index]', 'stack[0]', null)));

    parts.push('}');

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

  function generateMemoizeEnabledDefTable(ast) {
    var rv = [];
    arrays.each(ast.rules, function (r) {
      rv.push(+r.memoize);
    });
    return rv;
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

          case op.LOAD_SAVED_POS:     // LOAD_SAVED_POS p
            parts.push('peg$savedPos = ' + stack.index(bc[ip + 1]) + ';');
            parts.push('peg$currentRule = peg$currentRuleIndex;');
            ip += 2;
            break;

          case op.UPDATE_SAVED_POS:   // UPDATE_SAVED_POS
            parts.push('peg$savedPos = peg$currPos;');
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
    ], traceSupport([
      '  var startPos = peg$currPos;'
    ]), runTimeStatistics([
      '  var peg$statisticsRef = peg$memoize_use_counters[peg$currentRuleIndex];',
      '  var peg$statisticsParentRef = peg$statisticsRef.visitingParent[peg$parentRuleIndex] || {};',
      '',
      '  peg$statisticsRef.visit++;',
      '  peg$statisticsParentRef.visit++;',
    ])
    ).join('\n'));

    parts.push(indent2(
      generateMemoizationHeader('"' + js.stringEscape(rule.name) + '"', asts.indexOfRule(ast, rule.name), rule)
    ));

    parts.push(indent2(code));

    parts.push(indent2(
      generateMemoizationFooter('"' + js.stringEscape(rule.name) + '"', s(0), rule)
    ));

    parts.push('}');

    return parts.join('\n');
  }

  var parts = [],
      startRuleIndices,   startRuleIndex,
      startRuleFunctions, startRuleFunction,
      ruleNames;

  parts.push([
    '(function(global) {',
    '  "use strict";',
    '',
    '  /*',
    '   * Generated by PEG.js 0.8.0.',
    '   *',
    '   * http://pegjs.org/',
    '   */',
    '',
    '  function peg$subclass(child, parent) {',
    '    function Ctor() {}',
    '    Ctor.prototype = parent.prototype;',
    '    child.prototype = new Ctor();',
    '    child.prototype.constructor = child;',
    '  }',
    '',
    '  function Peg$SyntaxError(message, expected, found, location) {',
    '    var err;',
    '',
    '    this.message  = message;',
    '    this.expected = expected;',
    '    this.found    = found;',
    '    this.location = location;',
    '    this.name     = "SyntaxError";',
    '',
    '    if (typeof Error.captureStackTrace !== "function") {',
    '      err = new Error(message);',
    '      if (typeof Object.defineProperty === "function") {',
    '        Object.defineProperty(this, "stack", {',
    '          get: function () {',
    '            return err.stack;',
    '          }',
    '        });',
    '      } else {',
    '        this.stack = err.stack;',
    '      }',
    '    } else {',
    '      Error.captureStackTrace(this, Peg$SyntaxError);',
    '    }',
    '',
    '    return this;',
    '  }',
    '',
    '  peg$subclass(Peg$SyntaxError, Error);',
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
      '  var peg$memoize_use_counters = new Array(' + ast.rules.length + ');',
      '  var peg$memoize_enabled = [' + generateMemoizeEnabledDefTable(ast).join(',') + '];',
      '',
      '  function peg$getStatistics(reset) {',
      '    var rv = {',
      '      counters: peg$memoize_use_counters.slice(0),',
      '      rulenames: peg$index2rule_name,',
      '      hasMemoization: peg$memoize_enabled',
      '    };',
      '',
      '    if (reset) {',
      '      var i, j, len;',
      '',
      '      for (i = 0, len = peg$memoize_use_counters.length; i < len; i++) {',
      '        var parents = new Array(' + ast.rules.length + ');',
      '        for (j = 0; j < ' + ast.rules.length + '; j++) {',
      '          parents[j] = {',
      '            visit: 0,',
      '            cacheHit: 0',
      '          };',
      '        }',
      '        peg$memoize_use_counters[i] = {',
      '          visit: 0,',                    // number of calls into the rule parsing function
      '          visitingParent: parents,',     // track visits from which parents, including which visits led to a cache hit, etc.
      '          cacheHit: 0,',                 // number of times the memoization kicked in (packrat)
      '          returnFail: 0,',               // number of calls which returned FAIL (excluding memoized items!)
      '          returnSilentFail: 0,',         // number of calls which returned FAIL inside a predicate environment (excluding memoized items!)
      '          returnCachedFail: 0,',         // number of calls which returned FAIL from the memo cache
      '          returnCachedSilentFail: 0,',   // number of calls which returned FAIL from the memo cache inside a predicate environment
      '          fail: 0,',                     // number of times the state machine registered an internal fail state
      '          silentFail: 0,',               // number of times the state machine registered an internal fail state inside a predicate environment
      '          pushedFail: 0,',               // number of times the state machine pushed an explicit FAIL into the stream
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

  if (options.trace) {
    parts.push([
      '  function Peg$DefaultTracer() {',
      '    this.indentLevel = 0;',
      '  }',
      '',
      '  Peg$DefaultTracer.prototype.trace = function(event) {',
      '    var that = this;',
      '',
      '    function log(event) {',
      '      function repeat(string, n) {',
      '         var result = "", i;',
      '',
      '         for (i = 0; i < n; i++) {',
      '           result += string;',
      '         }',
      '',
      '         return result;',
      '      }',
      '',
      '      function pad(string, length) {',
      '        return string + repeat(" ", length - string.length);',
      '      }',
      '',
      '      console.log(',
      '        event.location.start.line + ":" + event.location.start.column + "-"',
      '          + event.location.end.line + ":" + event.location.end.column + " "',
      '          + pad(event.type, 10) + " "',
      '          + repeat("  ", that.indentLevel) + event.rule',
      '      );',
      '    }',
      '',
      '    switch (event.type) {',
      '      case "rule.enter":',
      '        log(event);',
      '        this.indentLevel++;',
      '        break;',
      '',
      '      case "rule.match":',
      '        this.indentLevel--;',
      '        log(event);',
      '        break;',
      '',
      '      case "rule.fail":',
      '        this.indentLevel--;',
      '        log(event);',
      '        break;',
      '',
      '      default:',
      '        throw new Error("Invalid event type: " + event.type + ".");',
      '    }',
      '  };',
      ''
    ].join('\n'));
  }

  parts.push([
    '  function peg$parse(input) {',
    '    var options = arguments[1] !== undefined ? arguments[1] : {},',
    '        parser  = this,  // jshint ignore:line',
    '',
    '        peg$FAILED = {},',
    ''
  ].join('\n'));

  if (options.optimize === "size") {
    startRuleIndex = false;
    startRuleIndices = '{ '
                     + arrays.map(
                         arrays.filter(ast.rules, function (r, i) {
                           if (r.isStarterRule === 2) {
                             startRuleIndex = i;
                           }
                           return r.isStarterRule;
                         }),
                         function(r) { 
                           return r.name + ': ' + asts.indexOfRule(ast, r.name); 
                         }
                       ).join(', ')
                     + ' }';

    parts.push([
      '        peg$startRuleIndices = ' + startRuleIndices + ',',
      '        peg$startRuleIndex   = ' + startRuleIndex + ','
    ].join('\n'));
  } else {
    startRuleFunction = false;
    startRuleFunctions = '{ '
                     + arrays.map(
                         arrays.filter(ast.rules, function (r, i) {
                           if (r.isStarterRule === 2) {
                             startRuleFunction = 'peg$parse' + r.name;
                           }
                           return r.isStarterRule;
                         }),
                         function(r) { 
                           return r.name + ': peg$parse' + r.name; 
                         }
                       ).join(', ')
                     + ' }';

    parts.push([
      '        peg$startRuleFunctions = ' + startRuleFunctions + ',',
      '        peg$startRuleFunction  = ' + startRuleFunction + ','
    ].join('\n'));
  }

  parts.push('');

  parts.push(indent8(generateTables()));

  parts.push([
    '',
    '        peg$currPos            = options.startOffset || 0,',
    '        peg$savedPos           = options.startOffset || 0,',
    '        peg$memoizedPos        = 0,',
    '        peg$memoizedPosDetails = [{ line: 1, column: 1, seenCR: false }],',
    '        peg$maxFailPos         = 0,',
    '        peg$maxFailExpected    = [],',
    '        peg$silentFails        = 0,     // 0 = report failures, > 0 = silence failures',
    '        peg$currentRule        = null,  // null or a number representing the rule; the latter is an index into the peg$index2rule_name[] rule name array',
    ''
  ].join('\n'));

  if (options.cache) {
    parts.push('        peg$memoize = {},');
  }

  if (options.trace) {
    if (options.optimize === "size") {
      ruleNames = '['
                + arrays.map(
                    ast.rules,
                    function(r) { 
                      return '"' + js.stringEscape(r.name) + '"'; 
                    }
                  ).join(', ')
                + ']';

      parts.push([
        '        peg$ruleNames = ' + ruleNames + ',',
        ''
      ].join('\n'));
    }

    parts.push([
      '        peg$tracer = "tracer" in options ? options.tracer : new Peg$DefaultTracer(),',
      ''
    ].join('\n'));
  }

  parts.push([
    '        peg$result;',
    ''
  ].join('\n'));

  if (options.optimize === "size") {
    parts.push([
      '    if (options.startRule !== undefined) {',
      '      if (!(options.startRule in peg$startRuleIndices)) {',
      '        throw new Error("Can\'t start parsing from rule \\"" + options.startRule + "\\".");',
      '      }',
      '',
      '      peg$startRuleIndex = peg$startRuleIndices[options.startRule];',
      '    }'
    ].join('\n'));
  } else {
    parts.push([
      '    if (options.startRule !== undefined) {',
      '      if (!(options.startRule in peg$startRuleFunctions)) {',
      '        throw new Error("Can\'t start parsing from rule \\"" + options.startRule + "\\".");',
      '      }',
      '',
      '      peg$startRuleFunction = peg$startRuleFunctions[options.startRule];',
      '    }'
    ].join('\n'));
  }

  parts.push(arrays.merge([
    '    //{ Helper functions',
    '    function text() {',
    '      return input.substring(peg$savedPos, peg$currPos);',
    '    }',
    '',
    '    function ruleIndex() {',
    '      return peg$currentRule;',
    '    }',
    ''
  ], ((options.collectRunTimeStatistics || options.includeRuleNames) ? [
    '    function ruleName(index) {',
    '      index = (index == null ? peg$currentRule : index);',
    '      return index !== null ? (peg$index2rule_name[index] || null) : null;',
    '    }',
    ''
  ] : []), [
    '    function location() {',
    '      return peg$computeLocation(peg$savedPos, peg$currPos);',
    '    }',
    '',
    '    function expected(description) {',
    '      throw peg$buildException(',
    '        null,',
    '        [{ type: "other", description: description }],',
    '        input.substring(peg$savedPos, peg$currPos),',
    '        peg$computeLocation(peg$savedPos, peg$currPos)',
    '      );',
    '    }',
    '',
    '    function error(message) {',
    '      throw peg$buildException(',
    '        message,',
    '        null,',
    '        input.substring(peg$savedPos, peg$currPos),',
    '        peg$computeLocation(peg$savedPos, peg$currPos)',
    '      );',
    '    }',
    '',
    '    function peg$computePosDetails(pos) {',
    '      var details = peg$memoizedPosDetails[pos],',
    '          p, ch;',
    '',
    '      if (details) {',
    '        return details;',
    '      } else {',
    '        p = pos - 1;',
    '        while (!peg$memoizedPosDetails[p]) {',
    '          p--;',
    '        }',
    '',
    '        details = peg$memoizedPosDetails[p];',
    '        details = {',
    '          line:   details.line,',
    '          column: details.column,',
    '          seenCR: details.seenCR',
    '        };',
    '',
    '        while (p < pos) {',
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
    '',
    '          p++;',
    '        }',
    '',
    '        peg$memoizedPosDetails[pos] = details;',
    '        return details;',
    '      }',
    '    }',
    '',
    '    function peg$computeLocation(startPos, endPos) {',
    '      var startPosDetails = peg$computePosDetails(startPos),',
    '          endPosDetails   = peg$computePosDetails(endPos);',
    '',
    '      return {',
    '        start: {',
    '          offset: startPos,',
    '          line:   startPosDetails.line,',
    '          column: startPosDetails.column',
    '        },',
    '        end: {',
    '          offset: endPos,',
    '          line:   endPosDetails.line,',
    '          column: endPosDetails.column',
    '        }',
    '      };',
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
    '    function peg$buildException(message, expected, found, location) {',
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
    '        expectedDesc = expected.length > 1 ?',
    '          expectedDescs.slice(0, -1).join(", ") +',
    '              " or " +',
    '              expectedDescs[expected.length - 1]',
    '          : expectedDescs[0];',
    '',
    '        foundDesc = found.length ? "\\"" + stringEscape(found) + "\\"" : "end of input";',
    '',
    '        return "Expected " + expectedDesc + " but " + foundDesc + " found.";',
    '      }',
    '',
    '      /* TBD TBD TBD TBD TBD TBD TBD TBD TBD TBD TBD TBD TBD TBD TBD TBD TBD TBD TBD TBD TBD TBD TBD',
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
    '      */',
    '',
    '      if (expected !== null) {',
    '        cleanupExpected(expected);',
    '      }',
    '',
    '      return new Peg$SyntaxError(',
    '        message !== null ? message : buildMessage(expected, found),',
    '        expected,',
    '        found,',
    '        location',
    '      );',
    '    }',
    '    //}'
  ]).join('\n'));

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

  parts.push(arrays.merge([
    '',
    '    if (peg$result !== peg$FAILED && peg$currPos === input.length) {',
    '      return peg$result;',
    '    } else {',
    '      if (peg$result !== peg$FAILED && peg$currPos < input.length) {',
    '        peg$fail({ type: "end", description: "end of input" }, -1);',
    '      }',
    '',
    '      throw peg$buildException(',
    '        null,',
    '        peg$maxFailExpected,',
    '        peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null,',
    '        peg$maxFailPos < input.length',
    '          ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1)',
    '          : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)',
    '      );',
    '    }',
    '  }',
    '',
    '  var peg$result = {',
    '    SyntaxError:            Peg$SyntaxError,',
  ], traceSupport([
    '    DefaultTracer:          Peg$DefaultTracer,',
  ]), runTimeStatistics([
    '    getStatistics:          peg$getStatistics,'
  ]), ((options.collectRunTimeStatistics || options.includeRuleNames) ? [
    '    getRuleNamesIndexTable: peg$getRuleNamesIndexTable,',
  ] : []), [
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
  ]).join('\n'));

  ast.code = parts.join('\n');
}

module.exports = generateJavascript;
