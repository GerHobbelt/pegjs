/* JSON parser based on the grammar described at http://json.org/. */

/* ===== Syntactical Elements ===== */

@nocache
start
  = _ object:object { return object; }

object
  = "{" _ "}" _                 { return {};      }
  / "{" _ members:members "}" _ { return members; }

members
  = head:pair tail:("," _ pair)* {
      var result = {};
      result[head[0]] = head[1];
      for (var i = 0; i < tail.length; i++) {
        result[tail[i][2][0]] = tail[i][2][1];
      }
      return result;
    }

pair
  = name:string ":" _ value:value { return [name, value]; }

array
  = "[" _ "]" _                   { return [];       }
  / "[" _ elements:elements "]" _ { return elements; }

elements
  = head:value tail:("," _ value)* {
      var result = [head];
      for (var i = 0; i < tail.length; i++) {
        result.push(tail[i][2]);
      }
      return result;
    }

value
  = string
  / number
  / object
  / array
  / "true" _  { return true;  }
  / "false" _ { return false; }
  / "null" _  { return null;  }

/* ===== Lexical Elements ===== */

string "string"
  = '"' '"' _             { return "";    }
  / '"' chars:chars '"' _ { return chars; }

chars
  = chars:char+ { return chars.join(""); }

@nocache
char
  // In the original JSON grammar: "any-Unicode-character-except-"-or-\-or-control-character"
  = [^"\\\0-\x1F\x7f]
  / '\\"'  { return '"';  }
  / "\\\\" { return "\\"; }
  / "\\/"  { return "/";  }
  / "\\b"  { return "\b"; }
  / "\\f"  { return "\f"; }
  / "\\n"  { return "\n"; }
  / "\\r"  { return "\r"; }
  / "\\t"  { return "\t"; }
  / "\\u" digits:$(hexDigit hexDigit hexDigit hexDigit) {
      return String.fromCharCode(parseInt(digits, 16));
    }

number "number"
  = parts:$(int frac exp) _ { return parseFloat(parts); }
  / parts:$(int frac) _     { return parseFloat(parts); }
  / parts:$(int exp) _      { return parseFloat(parts); }
  / parts:$(int) _          { return parseFloat(parts); }

@nocache
int
  = digit19 digits
  / digit
  / "-" digit19 digits
  / "-" digit

@nocache
frac
  = "." digits

@nocache
exp
  = e digits

@nocache
digits
  = digit+

@nocache
e
  = [eE] [+-]?

/*
 * The following rules are not present in the original JSON gramar, but they are
 * assumed to exist implicitly.
 *
 * FIXME: Define them according to ECMA-262, 5th ed.
 */

@nocache
digit
  = [0-9]

@nocache
digit19
  = [1-9]

@nocache
hexDigit
  = [0-9a-fA-F]

/* ===== Whitespace ===== */

_ "whitespace"
  = whitespace*

// Whitespace is undefined in the original JSON grammar, so I assume a simple
// conventional definition consistent with ECMA-262, 5th ed.
@nocache
whitespace
  = [ \t\n\r]
