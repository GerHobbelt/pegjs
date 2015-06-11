/* Bytecode instruction opcodes. */
var opcodes = {
  /* Stack Manipulation */

  PUSH:             0,    // PUSH c
  PUSH_UNDEFINED:   26,   // PUSH_UNDEFINED
  PUSH_NULL:        27,   // PUSH_NULL
  PUSH_FAILED:      28,   // PUSH_FAILED
  PUSH_EMPTY_ARRAY: 29,   // PUSH_EMPTY_ARRAY
  PUSH_CURR_POS:    1,    // PUSH_CURR_POS
  POP:              2,    // POP
  POP_CURR_POS:     3,    // POP_CURR_POS
  POP_N:            4,    // POP_N n
  NIP:              5,    // NIP
  APPEND:           6,    // APPEND
  WRAP:             7,    // WRAP n
  TEXT:             8,    // TEXT

  /* Conditions and Loops */

  IF:               9,    // IF t, f
  IF_ERROR:         10,   // IF_ERROR t, f
  IF_NOT_ERROR:     11,   // IF_NOT_ERROR t, f
  IF_ARRLEN_MIN:    30,   // IF_ARRLEN_MIN min, t, f
  IF_ARRLEN_MAX:    31,   // IF_ARRLEN_MAX max, t, f
  WHILE_NOT_ERROR:  14,   // WHILE_NOT_ERROR b

  /* Matching */

  MATCH_ANY:        15,   // MATCH_ANY a, f, ...
  MATCH_STRING:     16,   // MATCH_STRING s, a, f, ...
  MATCH_STRING_IC:  17,   // MATCH_STRING_IC s, a, f, ...
  MATCH_REGEXP:     18,   // MATCH_REGEXP r, a, f, ...
  ACCEPT_N:         19,   // ACCEPT_N n
  ACCEPT_STRING:    20,   // ACCEPT_STRING s
  FAIL:             21,   // FAIL e

  /* Calls */

  LOAD_SAVED_POS:   22,   // LOAD_SAVED_POS p
  UPDATE_SAVED_POS: 23,   // UPDATE_SAVED_POS
  CALL:             24,   // CALL f, n, pc, p1, p2, ..., pN

  /* Rules */

  RULE:             25,   // RULE r

  /* Failure Reporting */

  SILENT_FAILS_ON:  32,   // SILENT_FAILS_ON
  SILENT_FAILS_OFF: 33,   // SILENT_FAILS_OFF
  SILENT_FAILS_RESET: 34  // SILENT_FAILS_RESET
};

module.exports = opcodes;
