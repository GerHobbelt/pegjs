var arrays  = require("../../utils/arrays"),
    objects = require("../../utils/objects"),
    asts    = require("../asts"),
    visitor = require("../visitor"),
    op      = require("../opcodes"),
    js      = require("../javascript");

/* Generates bytecode.
 * function interpret(min, max) {...} -- run part of bytecode: bytecode[min:max]
 *
 * Instructions
 * ============
 *
 * Stack Manipulation
 * ------------------
 *
 *  [0] PUSH c
 *
 *        stack.push(consts[c]);
 *
 * [26] PUSH_UNDEFINED
 *
 *        stack.push(undefined);
 *
 * [27] PUSH_NULL
 *
 *        stack.push(null);
 *
 * [28] PUSH_FAILED
 *
 *        stack.push(FAILED);
 *
 * [29] PUSH_EMPTY_ARRAY
 *
 *        stack.push([]);
 *
 *  [1] PUSH_CURR_POS
 *
 *        stack.push(currPos);
 *
 *  [2] POP
 *
 *        stack.pop();
 *
 *  [3] POP_CURR_POS
 *
 *        currPos = stack.pop();
 *
 *  [4] POP_N n
 *
 *        stack.pop(n);
 *
 *  [5] NIP
 *
 *        value = stack.pop();
 *        stack.pop();
 *        stack.push(value);
 *
 *  [6] APPEND
 *
 *        value = stack.pop();
 *        array = stack.pop();
 *        array.push(value);
 *        stack.push(array);
 *
 *  [7] WRAP n
 *
 *        stack.push(stack.pop(n));
 *
 *  [8] TEXT
 *
 *        stack.push(input.substring(stack.pop(), currPos));
 *
 * Conditions and Loops
 * --------------------
 *
 *  [9] IF t, f
 *
 *        if (stack.top()) {
 *          interpret(ip + 3, ip + 3 + t);
 *        } else {
 *          interpret(ip + 3 + t, ip + 3 + t + f);
 *        }
 *
 * [10] IF_ERROR t, f
 *
 *        if (stack.top() === FAILED) {
 *          interpret(ip + 3, ip + 3 + t);
 *        } else {
 *          interpret(ip + 3 + t, ip + 3 + t + f);
 *        }
 *
 * [11] IF_NOT_ERROR t, f
 *
 *        if (stack.top() !== FAILED) {
 *          interpret(ip + 3, ip + 3 + t);
 *        } else {
 *          interpret(ip + 3 + t, ip + 3 + t + f);
 *        }
 *
 * [30] IF_ARRLEN_MIN min, t, f
 *
 *        if (stack.top().length < min) {
 *          interpret(ip + 3, ip + 3 + t);
 *        } else {
 *          interpret(ip + 3 + t, ip + 3 + t + f);
 *        }
 *
 * [31] IF_ARRLEN_MAX max, t, f
 *
 *        if (stack.top().length >= max) {
 *          interpret(ip + 3, ip + 3 + t);
 *        } else {
 *          interpret(ip + 3 + t, ip + 3 + t + f);
 *        }
 *
 * [12] WHILE_NOT_ERROR b
 *
 *        while(stack.top() !== FAILED) {
 *          interpret(ip + 2, ip + 2 + b);
 *        }
 *
 * Matching
 * --------
 *
 * [13] MATCH_ANY a, f, ...
 *
 *        if (input.length > currPos) {
 *          interpret(ip + 3, ip + 3 + a);
 *        } else {
 *          interpret(ip + 3 + a, ip + 3 + a + f);
 *        }
 *
 * [14] MATCH_STRING s, a, f, ...
 *
 *        if (input.substr(currPos, consts[s].length) === consts[s]) {
 *          interpret(ip + 4, ip + 4 + a);
 *        } else {
 *          interpret(ip + 4 + a, ip + 4 + a + f);
 *        }
 *
 * [15] MATCH_STRING_IC s, a, f, ...
 *
 *        if (input.substr(currPos, consts[s].length).toLowerCase() === consts[s]) {
 *          interpret(ip + 4, ip + 4 + a);
 *        } else {
 *          interpret(ip + 4 + a, ip + 4 + a + f);
 *        }
 *
 * [16] MATCH_REGEXP r, a, f, ...
 *
 *        if (consts[r].test(input.charAt(currPos))) {
 *          interpret(ip + 4, ip + 4 + a);
 *        } else {
 *          interpret(ip + 4 + a, ip + 4 + a + f);
 *        }
 *
 * [17] ACCEPT_N n
 *
 *        stack.push(input.substring(currPos, n));
 *        currPos += n;
 *
 * [18] ACCEPT_STRING s
 *
 *        stack.push(consts[s]);
 *        currPos += consts[s].length;
 *
 * [19] FAIL e
 *
 *        stack.push(FAILED);
 *        fail(consts[e]);
 *
 * Calls
 * -----
 *
 * [20] LOAD_SAVED_POS p
 *
 *        savedPos = stack[p];
 *
 * [21] UPDATE_SAVED_POS
 *
 *        savedPos = currPos;
 *
 * [22] CALL f, n, pc, p1, p2, ..., pN
 *
 *        value = actions[f](stack[p1], ..., stack[pN]);
 *        stack.pop(n);
 *        stack.push(value);
 *
 * Rules
 * -----
 *
 * [23] RULE r
 *
 *        stack.push(parseRule(r));
 *
 * Failure Reporting
 * -----------------
 *
 * [32] SILENT_FAILS_ON
 *
 *        silentFails++;
 *
 * [33] SILENT_FAILS_OFF
 *
 *        silentFails--;
 *
 * [34] SILENT_FAILS_RESET
 *
 *        silentFails = 0;
 */
function generateBytecode(ast) {
  var consts = [];
  var constTypes = [];
  var actions = [];
  
  /// Add new constant to constant list, if it does not exist, and return the index in that list.
  function addConst(type, value) {
    var index = arrays.indexOf(consts, value);

    var rv = (index === -1 ? consts.push(value) - 1 : index);
    constTypes[rv] = type;
    return rv;
  }

  function addFunctionConst(params, code) {
    var pList = params.join(',');
    var index = arrays.indexOf(actions, function(a) { 
      return a[0].join(',') === pList && a[1] === code; 
    });

    return index === -1 ? actions.push([params, code]) - 1 : index;
  }

  function buildSequence() {
    return Array.prototype.concat.apply([], arguments);
  }

  function buildCondition(condCode, thenCode, elseCode) {
    return condCode.concat(
      [thenCode.length, elseCode.length],
      thenCode,
      elseCode
    );
  }

  function buildLoop(condCode, bodyCode) {
    return condCode.concat([bodyCode.length], bodyCode);
  }

  function buildCall(functionIndex, delta, env, sp) {
    var params = arrays.map(objects.values(env), function(p) { 
      return sp - p; 
    });

    return [op.CALL, functionIndex, delta, params.length].concat(params);
  }

  function buildSimplePredicate(expression, node, negative, context) {
    return buildSequence(
      [op.PUSH_CURR_POS],
      [op.SILENT_FAILS_ON],
      generate(expression, node, {
        sp:     context.sp + 1,
        env:    objects.clone(context.env),
        action: null
      }),
      [op.SILENT_FAILS_OFF],
      buildCondition(
        [negative ? op.IF_ERROR : op.IF_NOT_ERROR],
        buildSequence(
          [op.POP],
          [negative ? op.POP : op.POP_CURR_POS],
          [op.PUSH_UNDEFINED]
        ),
        buildSequence(
          [op.POP],
          [negative ? op.POP_CURR_POS : op.POP],
          [op.PUSH_FAILED]
        )
      )
    );
  }

  function buildSemanticPredicate(code, negative, context) {
    var functionIndex = addFunctionConst(objects.keys(context.env), code);

    return buildSequence(
      [op.UPDATE_SAVED_POS],
      [op.SILENT_FAILS_ON],
        buildCall(functionIndex, 0, context.env, context.sp),
      [op.SILENT_FAILS_OFF],
      buildCondition(
        [op.IF],
        buildSequence(
          [op.POP],
          negative ? [op.PUSH_FAILED] : [op.PUSH_UNDEFINED]
        ),
        buildSequence(
          [op.POP],
          negative ? [op.PUSH_UNDEFINED] : [op.PUSH_FAILED]
        )
      )
    );
  }

  function buildAppendLoop(expressionCode) {
    return buildLoop(
      [op.WHILE_NOT_ERROR],                 // while (elem !== peg$FAILED) {
      buildSequence(
        [op.APPEND],                        //   result.push(elem);     stack:[ [elem...] ]
        expressionCode                      // }                        stack:[ [elem...], elem ]
      )
    );
  }

  var generate = visitor.build({
    grammar: function(node, parent) {
      arrays.each(node.rules, function (rule) {
        generate(rule, node);
      });

      node.consts = consts;
      node.constTypes = constTypes;
      node.actions = actions;
    },

    rule: function(node, parent) {
      node.bytecode = generate(node.expression, node, {
        sp:     -1,    // stack pointer
        env:    { },   // mapping of label names to stack positions
        action: null   // action nodes pass themselves to children here
      });
    },

    named: function(node, parent, context) {
      var nameIndex = addConst(
        'expected',
        '{ type: "other", description: "' + js.stringEscape(node.name) + '" }'
      );

      /*
       * The code generated below is slightly suboptimal because |FAIL| pushes
       * to the stack, so we need to stick a |POP| in front of it. We lack a
       * dedicated instruction that would just report the failure and not touch
       * the stack.
       */
      return buildSequence(
        [op.SILENT_FAILS_ON],
        generate(node.expression, node, {
          sp:     context.sp,
          env:    context.env,
          action: context.action
        }),
        [op.SILENT_FAILS_OFF],
        buildCondition([op.IF_ERROR], [op.SILENT_FAILS_RESET], []),
        buildCondition([op.IF_ERROR], [op.FAIL, nameIndex], [])
      );
    },

    choice: function(node, parent, context) {
      function buildAlternativesCode(alternatives, context) {
        return buildSequence(
          generate(alternatives[0], node, {
            sp:     context.sp,
            env:    objects.clone(context.env),
            action: null
          }),
          alternatives.length > 1
            ? buildCondition(
                [op.IF_ERROR],
                buildSequence(
                  [op.POP],
                  buildAlternativesCode(alternatives.slice(1), context)
                ),
                []
              )
            : []
        );
      }

      return buildAlternativesCode(node.alternatives, context);
    },

    action: function(node, parent, context) {
      var env            = objects.clone(context.env),
          emitCall       = node.expression.type !== "sequence"
                        || node.expression.elements.length === 0,
          expressionCode = generate(node.expression, node, {
            sp:     context.sp + (emitCall ? 1 : 0),
            env:    env,
            action: node
          }),
          functionIndex  = addFunctionConst(objects.keys(env), node.code);

      return emitCall
        ? buildSequence(
            [op.PUSH_CURR_POS],
            expressionCode,
            buildCondition(
              [op.IF_NOT_ERROR],
              buildSequence(
                [op.LOAD_SAVED_POS, 1],
                buildCall(functionIndex, 1, env, context.sp + 2)
              ),
              []
            ),
            [op.NIP]
          )
        : expressionCode;
    },

    sequence: function(node, parent, context) {
      function buildElementsCode(elements, context) {
        var processedCount, functionIndex;

        if (elements.length > 0) {
          processedCount = node.elements.length - elements.slice(1).length;

          return buildSequence(
            generate(elements[0], node, {
              sp:     context.sp,
              env:    context.env,
              action: null
            }),
            buildCondition(
              [op.IF_NOT_ERROR],
              buildElementsCode(elements.slice(1), {
                sp:     context.sp + 1,
                env:    context.env,
                action: context.action
              }),
              buildSequence(
                processedCount > 1 ? [op.POP_N, processedCount] : [op.POP],
                [op.POP_CURR_POS],
                [op.PUSH_FAILED]
              )
            )
          );
        } else {
          if (context.action) {
            functionIndex = addFunctionConst(
              objects.keys(context.env),
              context.action.code
            );

            return buildSequence(
              [op.LOAD_SAVED_POS, node.elements.length],
              buildCall(
                functionIndex,
                node.elements.length,
                context.env,
                context.sp
              ),
              [op.NIP]
            );
          } else {
            return buildSequence([op.WRAP, node.elements.length], [op.NIP]);
          }
        }
      }

      return buildSequence(
        [op.PUSH_CURR_POS],
        buildElementsCode(node.elements, {
          sp:     context.sp + 1,
          env:    context.env,
          action: context.action
        })
      );
    },

    labeled: function(node, parent, context) {
      var env = objects.clone(context.env);
      
      if (node.label != null) {
        context.env[node.label] = context.sp + 1;
      }

      return generate(node.expression, node, {
        sp:     context.sp,
        env:    env,
        action: null
      });
    },

    text: function(node, parent, context) {
      return buildSequence(
        [op.PUSH_CURR_POS],
        generate(node.expression, node, {
          sp:     context.sp + 1,
          env:    objects.clone(context.env),
          action: null
        }),
        buildCondition(
          [op.IF_NOT_ERROR],
          buildSequence([op.POP], [op.TEXT]),
          [op.NIP]
        )
      );
    },

    simple_and: function(node, parent, context) {
      return buildSimplePredicate(node.expression, node, false, context);
    },

    simple_not: function(node, parent, context) {
      return buildSimplePredicate(node.expression, node, true, context);
    },

    optional: function(node, parent, context) {
      return buildSequence(
        generate(node.expression, node, {
          sp:     context.sp,
          env:    objects.clone(context.env),
          action: null
        }),
        buildCondition(
          [op.IF_ERROR],
          buildSequence([op.POP], [op.PUSH_NULL]),
          []
        )
      );
    },

    zero_or_more: function(node, parent, context) {
      var expressionCode = generate(node.expression, node, {
            sp:     context.sp + 1,
            env:    objects.clone(context.env),
            action: null
          });

      return buildSequence(
        [op.PUSH_EMPTY_ARRAY],
        expressionCode,
        buildAppendLoop(expressionCode),
        [op.POP]
      );
    },

    one_or_more: function(node, parent, context) {
      var expressionCode = generate(node.expression, node, {
            sp:     context.sp + 1,
            env:    objects.clone(context.env),
            action: null
          });

      return buildSequence(
        [op.PUSH_EMPTY_ARRAY],
        expressionCode,
        buildCondition(
          [op.IF_NOT_ERROR],
          buildSequence(buildAppendLoop(expressionCode), [op.POP]),
          buildSequence([op.POP], [op.POP], [op.PUSH_FAILED])
        )
      );
    },

    semantic_and: function(node, parent, context) {
      return buildSemanticPredicate(node.code, false, context);
    },

    semantic_not: function(node, parent, context) {
      return buildSemanticPredicate(node.code, true, context);
    },

    rule_ref: function(node, parent, context) {
      return [op.RULE, asts.indexOfRule(ast, node.name)];
    },

    range: function(node, parent, context) {
      var expressionCode = generate(node.expression, node, {
            sp:     context.sp + 1,
            env:    { },
            action: null
          }),
          bodyCode       = node.delimiter !== null ?
            buildSequence(                  //                          stack:[  ]
              [op.PUSH_CURR_POS],           // x = peg$currPos;         stack:[ pos ]
              generate(node.delimiter, node, {    // item = delim();          stack:[ pos, delim ]
                sp:     context.sp + 1,
                env:    { },
                action: null
              }),
              buildCondition(
                [op.IF_NOT_ERROR],          // if (item !== peg$FAILED) {
                buildSequence(
                  op.POP,                   //                          stack:[ pos ]
                  expressionCode,           //   item = expr();         stack:[ pos, item ]
                  buildCondition(
                    [op.IF_ERROR],          //   if (item === peg$FAILED) {
                    // If element FAILED, rollback currPos to saved value.
                    [op.POP,                //                          stack:[ pos ]
                     op.POP_CURR_POS,       //     peg$currPos = x;     stack:[  ]
                     op.PUSH_FAILED],       //     item = peg$FAILED;   stack:[ peg$FAILED ]
                    // Else, just drop saved currPos.
                    [op.NIP]                //   }                      stack:[ item ]
                  )
                ),                          // }
                // If delimiter FAILED, currPos not changed, so just drop it.
                [op.NIP]                    //                          stack:[ peg$FAILED ]
              )                             //                          stack:[ <?> ]
            ) : expressionCode,
          // Check high boundary, if it defined.
          checkMaxCode   = node.max !== null ?
            buildCondition(                 //   if (result.length >= max) {
              [op.IF_ARRLEN_MAX, node.max], //                          stack:[ [elem...] ]
              // push `peg$FAILED` - this breaks the loop on next iteration.
              [op.PUSH_FAILED],             //     elem = peg$FAILED;   stack:[ [elem...], peg$FAILED ]
              bodyCode                      //   } else {
            )                               //     elem = expr();       stack:[ [elem...], elem ]
            : bodyCode,                     //   }
          mainLoopCode   = buildSequence(
            [op.PUSH_EMPTY_ARRAY],          // var result = []          stack:[ [] ]
            expressionCode,                 // var elem = expr();       stack:[ [], elem ]
            buildAppendLoop(                // while (elem !== peg$FAILED) {
                                            //   result.push(elem);     stack:[ [elem...] ]
                checkMaxCode                //   if(r.len>=max)break;   stack:[ [elem...], elem|peg$FAILED ]
            ),                              // }                        stack:[ [elem...], elem ]
            [op.POP]                        //                          stack:[ [elem...] ] (pop elem===`peg$FAILED`)
          );
      // Check low boundary, if it is defined and not |0|.
      return node.min !== null && node.min > 0 ?
          buildSequence(
            mainLoopCode,                   // result = [elem...];      stack:[ [elem...] ]
            buildCondition(
              [op.IF_ARRLEN_MIN, node.min], // if (result.length < min) {
              [op.POP, op.PUSH_FAILED],     //   result = peg$FAILED;   stack:[ peg$FAILED ]
              []                            // }
            )
          ) : mainLoopCode;
    },

    literal: function(node, parent, context) {
      var stringIndex, expectedIndex;
      var nodeDescription = (node.description ? js.stringEscape(node.description.text) : false);      

      if (node.value.length > 0) {
        stringIndex = addConst('literal', '"'
          + js.stringEscape(
              node.ignoreCase ? node.value.toLowerCase() : node.value
            )
          + '"'
        );
        expectedIndex = addConst('expected', [
          '{',
          'type: "literal",',
          'value: "' + js.stringEscape(node.value) + '",',
          'description: "'
             + (nodeDescription || js.stringEscape('"' + js.stringEscape(node.value) + '"'))
             + '"',
          '}'
        ].join(' '));

        /*
         * For case-sensitive strings the value must match the beginning of the
         * remaining input exactly. As a result, we can use |ACCEPT_STRING| and
         * save one |substr| call that would be needed if we used |ACCEPT_N|.
         */
        return buildCondition(
          node.ignoreCase
            ? [op.MATCH_STRING_IC, stringIndex]
            : [op.MATCH_STRING, stringIndex],
          node.ignoreCase
            ? [op.ACCEPT_N, node.value.length]
            : [op.ACCEPT_STRING, stringIndex],
          [op.FAIL, expectedIndex]
        );
      } else {
        stringIndex = addConst('epsilon', '""');

        return [op.PUSH, stringIndex];
      }
    },

    "class": function(node, parent, context) {
      var regexp, regexpIndex, expectedIndex;
      var nodeDescription = (node.description ? js.stringEscape(node.description.text) : false);      

      if (node.parts.length > 0) {
        regexp = '/^['
          + (node.inverted ? '^' : '')
          + arrays.map(node.parts, function(part) {
              return part instanceof Array
                ? js.regexpClassEscape(part[0])
                  + '-'
                  + js.regexpClassEscape(part[1])
                : js.regexpClassEscape(part);
            }).join('')
          + ']/' + (node.ignoreCase ? 'i' : '');
      } else {
        /*
         * IE considers regexps /[]/ and /[^]/ as syntactically invalid, so we
         * translate them into equivalents it can handle.
         */
        regexp = node.inverted ? '/^[\\S\\s]/' : '/^(?!)/';
      }

      regexpIndex   = addConst('class', regexp);
      expectedIndex = addConst('expected', [
        '{',
        'type: "class",',
        'value: "' + js.stringEscape(node.rawText) + '",',
        'description: "' + (nodeDescription || js.stringEscape(node.rawText)) + '"',
        '}'
      ].join(' '));

      return buildCondition(
        [op.MATCH_REGEXP, regexpIndex],
        [op.ACCEPT_N, 1],
        [op.FAIL, expectedIndex]
      );
    },

    regex: function(node, parent, context) {
      var regexp, regexpIndex, expectedIndex;
      var nodeDescription = (node.description ? js.stringEscape(node.description.text) : false);      

      if (node.value.length > 0) {
        regexp = '/^'
          + node.value
          + '/' + (node.ignoreCase ? 'i' : '') + (node.multiLine ? 'm' : '');
      } else {
        /*
         * IE considers regexps /[]/ and /[^]/ as syntactically invalid, so we
         * translate them into equivalents it can handle.
         */
        regexp = '/^(?!)/';
      }

      regexpIndex   = addConst('regexp', regexp);
      expectedIndex = addConst('expected', [
        '{',
        'type: "regex",',
        'value: "' + js.stringEscape(node.rawText) + '",',
        'description: "' + (nodeDescription || js.stringEscape(node.rawText)) + '"',
        '}'
      ].join(' '));

      return buildCondition(
        [op.MATCH_REGEXP, regexpIndex],
        [op.ACCEPT_N, 1],
        [op.FAIL, expectedIndex]
      );
    },

    code: function (node, parent, context) {
      var nodeDescription = (node.description ? js.stringEscape(node.description.text) : false);      

      var functionIndex = addFunctionConst(objects.keys(context.env), node.code);
      
      expectedIndex = addConst('expected', [
        '{',
        'type: "code",',
        'value: "' + js.stringEscape(node.code) + '",',
        'description: "' + (nodeDescription || js.stringEscape(node.code)) + '"',
        '}'
      ].join(' '));

      return buildSequence(
        buildCall(functionIndex, 0, context.env, context.sp),
        [op.NIP],
        buildCondition(
          [op.IF_ERROR],
          [op.FAIL, expectedIndex],
          []
        )
      );
    },

    any: function(node, parent, context) {//stack: -0 +1
      var expectedIndex = addConst('expected', '{ type: "any", description: "any character" }');

      return buildCondition(
        [op.MATCH_ANY],
        [op.ACCEPT_N, 1],
        [op.FAIL, expectedIndex]
      );
    },

    epsilon: function(node, parent, context) {
      var nodeDescription = (node.description ? js.stringEscape(node.description.text) : false);      
      var stringIndex = addConst('epsilon', '""');

      return [op.PUSH, stringIndex];
    }
  });

  generate(ast);
}

module.exports = generateBytecode;
