/*
 * JSON Grammar
 * ============
 *
 * Based on the grammar from RFC 7159 [1].
 *
 * Note that JSON is also specified in ECMA-262 [2], ECMA-404 [3], and on the
 * JSON website [4] (somewhat informally). The RFC seems the most authoritative
 * source, which is confirmed e.g. by [5].
 *
 * [1] http://tools.ietf.org/html/rfc7159
 * [2] http://www.ecma-international.org/publications/standards/Ecma-262.htm
 * [3] http://www.ecma-international.org/publications/standards/Ecma-404.htm
 * [4] http://json.org/
 * [5] https://www.tbray.org/ongoing/When/201x/2014/03/05/RFC7159-JSON
 */

/* ----- 2. JSON Grammar ----- */

@nocache
JSON_text
  = ws value:value ws { return value; }

begin_array     = ws "[" ws
begin_object    = ws "{" ws
end_array       = ws "]" ws
end_object      = ws "}" ws
name_separator  = ws ":" ws
value_separator = ws "," ws

ws "whitespace" = [ \t\n\r]*

/* ----- 3. Values ----- */

value
  = False
  / Null
  / True
  / Object
  / Array
  / Number
  / String

False = "false" { return false; }
Null  = "null"  { return null;  }
True  = "true"  { return true;  }

/* ----- 4. Objects ----- */

Object
  = begin_object
    members:(
      first:member
      rest:(value_separator m:member { return m; })*
      {
        var result = {}, i;

        result[first.name] = first.value;

        for (i = 0; i < rest.length; i++) {
          result[rest[i].name] = rest[i].value;
        }

        return result;
      }
    )?
    end_object
    { return members !== null ? members: {}; }

member
  = name:String name_separator value:value {
      return { name: name, value: value };
    }

/* ----- 5. Arrays ----- */

Array
  = begin_array
    values:(
      first:value
      rest:(value_separator v:value { return v; })*
      { return [first].concat(rest); }
    )?
    end_array
    { return values !== null ? values : []; }

/* ----- 6. Numbers ----- */

Number "number"
  = minus? int frac? exp? { return parseFloat(text()); }

@nocache
decimal_point = "."
@nocache
digit1_9      = [1-9]
@nocache
e             = [eE]
@nocache
exp           = e (minus / plus)? DIGIT+
@nocache
frac          = decimal_point DIGIT+
@nocache
int           = zero / (digit1_9 DIGIT*)
@nocache
minus         = "-"
@nocache
plus          = "+"
@nocache
zero          = "0"

/* ----- 7. Strings ----- */

String "string"
  = quotation_mark chars:char* quotation_mark { return chars.join(""); }

@nocache
char
  = unescaped
  / escape
    sequence:(
        '"'
      / "\\"
      / "/"
      / "b" { return "\b"; }
      / "f" { return "\f"; }
      / "n" { return "\n"; }
      / "r" { return "\r"; }
      / "t" { return "\t"; }
      / "u" digits:$(HEXDIG HEXDIG HEXDIG HEXDIG) {
          return String.fromCharCode(parseInt(digits, 16));
        }
    )
    { return sequence; }

@nocache
escape         = "\\"

@nocache
quotation_mark = '"'

@nocache
unescaped      = [\x20-\x21\x23-\x5B\x5D-\u10FFFF]

/* ----- Core ABNF Rules ----- */

/* See RFC 4234, Appendix B (http://tools.ietf.org/html/rfc4627). */
@nocache
DIGIT  = [0-9]
@nocache
HEXDIG = [0-9a-f]i
