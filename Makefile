# ===== Variables =====

PEGJS_VERSION = `cat $(VERSION_FILE)`

# ===== Modules =====

# Order matters -- dependencies must be listed before modules dependent on them.
MODULES =                                            \
		  utils/arrays                               \
		  utils/objects                              \
		  utils/classes                              \
		  grammar-error                              \
		  parser                                     \
		  compiler/visitor                           \
          compiler/asts                              \
		  compiler/opcodes                           \
		  compiler/javascript                        \
		  statistics                                 \
		  compiler/passes/generate-bytecode          \
		  compiler/passes/generate-javascript        \
		  compiler/passes/remove-proxy-rules         \
		  compiler/passes/report-left-recursion      \
          compiler/passes/report-infinite-loops      \
		  compiler/passes/report-missing-rules       \
		  compiler/passes/report-unused-rules        \
          compiler/passes/report-duplicate-labels    \
          compiler/passes/report-duplicate-rules     \
		  compiler/passes/report-redefined-rules     \
		  compiler/passes/propagate-descriptions     \
		  compiler/passes/patch-ast-graph            \
		  compiler/passes/print-ruleset              \
		  compiler/passes/auto-label                 \
		  compiler/passes/setup-memoization          \
		  compiler/passes/calculate-consumption-info \
		  compiler                                   \
		  peg

# ===== Directories =====

SRC_DIR              = src
LIB_DIR              = lib
BIN_DIR              = bin
BROWSER_DIR          = browser
SPEC_DIR             = spec
BENCHMARK_DIR        = benchmark
NODE_MODULES_DIR     = node_modules
NODE_MODULES_BIN_DIR = $(NODE_MODULES_DIR)/.bin

# ===== Files =====

PARSER_SRC_FILE = $(SRC_DIR)/parser.pegjs
PARSER_OUT_FILE = $(LIB_DIR)/parser.js

BROWSER_FILE_DEV = $(BROWSER_DIR)/peg.js
BROWSER_FILE_MIN = $(BROWSER_DIR)/peg.min.js

VERSION_FILE = VERSION

# ===== Executables =====

JSHINT        = $(NODE_MODULES_BIN_DIR)/jshint
UGLIFYJS      = $(NODE_MODULES_BIN_DIR)/uglifyjs
JASMINE_NODE  = $(NODE_MODULES_BIN_DIR)/jasmine-node
PEGJS         = $(BIN_DIR)/pegjs
BENCHMARK_RUN = $(BENCHMARK_DIR)/run

# ===== Targets =====

# Default target
all: browser

# Generate the grammar parser
parser:
	$(PEGJS) --verbose --elapsed-time --cache --statistics  $(PARSER_SRC_FILE) $(PARSER_OUT_FILE)

# Build the browser version of the library
browser: parser
	mkdir -p $(BROWSER_DIR)

	rm -f $(BROWSER_FILE_DEV)
	rm -f $(BROWSER_FILE_MIN)

	# The following code is inspired by CoffeeScript's Cakefile.

	echo '/*'                                                                          >> $(BROWSER_FILE_DEV)
	echo " * PEG.js $(PEGJS_VERSION)"                                                  >> $(BROWSER_FILE_DEV)
	echo ' *'                                                                          >> $(BROWSER_FILE_DEV)
	echo ' * http://pegjs.org/'                                                        >> $(BROWSER_FILE_DEV)
	echo ' *'                                                                          >> $(BROWSER_FILE_DEV)
	echo ' * Copyright (c) 2010-2014 David Majda'                                      >> $(BROWSER_FILE_DEV)
	echo ' * Licensed under the MIT license.'                                          >> $(BROWSER_FILE_DEV)
	echo ' */'                                                                         >> $(BROWSER_FILE_DEV)
	echo 'var PEG = (function(undefined) {'                                            >> $(BROWSER_FILE_DEV)
	echo '  "use strict";'                                                             >> $(BROWSER_FILE_DEV)
	echo ''                                                                            >> $(BROWSER_FILE_DEV)
	echo '  var modules;'                                                              >> $(BROWSER_FILE_DEV)
	echo ''                                                                            >> $(BROWSER_FILE_DEV)
	echo '  function __require__(path, dir) {'                                         >> $(BROWSER_FILE_DEV)
	echo '    var name   = ((dir && path.indexOf("/") >= 0) ? dir : "") + path,'       >> $(BROWSER_FILE_DEV)
	echo '        regexp = /[^\/]+\/\.\.\/|\.\.\/|\.\/|\.js/;'                         >> $(BROWSER_FILE_DEV)
	echo ''                                                                            >> $(BROWSER_FILE_DEV)
	echo "    /* Can't use /.../g because we can move backwards in the string. */"     >> $(BROWSER_FILE_DEV)
	echo '    while (regexp.test(name)) {'                                             >> $(BROWSER_FILE_DEV)
	echo '      name = name.replace(regexp, "");'                                      >> $(BROWSER_FILE_DEV)
	echo '    }'                                                                       >> $(BROWSER_FILE_DEV)
	echo ''                                                                            >> $(BROWSER_FILE_DEV)
	echo '    return modules[name];'                                                   >> $(BROWSER_FILE_DEV)
	echo '  }'                                                                         >> $(BROWSER_FILE_DEV)
	echo ''                                                                            >> $(BROWSER_FILE_DEV)
	echo '  modules = {'                                                               >> $(BROWSER_FILE_DEV)
	echo '    define: function(name, factory) {'                                       >> $(BROWSER_FILE_DEV)
	echo '      var dir    = name.replace(/(^|\/)[^\/]+$$/, "$$1"),'                   >> $(BROWSER_FILE_DEV)
	echo '          module = { exports: {} };'                                         >> $(BROWSER_FILE_DEV)
	echo '      function require(path) {'                                              >> $(BROWSER_FILE_DEV)
	echo '        var rv = __require__(path, dir);'                                    >> $(BROWSER_FILE_DEV)
	echo '        if (!rv) {'                                                          >> $(BROWSER_FILE_DEV)
	echo '          throw new Error("require-ing undefined module: " + path);'         >> $(BROWSER_FILE_DEV)
	echo '        }'                                                                   >> $(BROWSER_FILE_DEV)
	echo '        return rv;'                                                          >> $(BROWSER_FILE_DEV)
	echo '      }'                                                                     >> $(BROWSER_FILE_DEV)
	echo ''                                                                            >> $(BROWSER_FILE_DEV)
	echo '      factory(module, require);'                                             >> $(BROWSER_FILE_DEV)
	echo '      this[name] = module.exports;'                                          >> $(BROWSER_FILE_DEV)
	echo '    }'                                                                       >> $(BROWSER_FILE_DEV)
	echo '  };'                                                                        >> $(BROWSER_FILE_DEV)
	echo ''                                                                            >> $(BROWSER_FILE_DEV)
	echo '  function assert(test) {'                                                   >> $(BROWSER_FILE_DEV)
	echo '    if (!test) {'                                                            >> $(BROWSER_FILE_DEV)
	echo '        throw new Error("assertion failed");'                                >> $(BROWSER_FILE_DEV)
	echo '    }'                                                                       >> $(BROWSER_FILE_DEV)
	echo '  }'                                                                         >> $(BROWSER_FILE_DEV)
	echo ''                                                                            >> $(BROWSER_FILE_DEV)
	echo '  modules["assert"] = assert;'                                               >> $(BROWSER_FILE_DEV)
	echo ''                                                                            >> $(BROWSER_FILE_DEV)

	for module in $(MODULES); do                                                                \
	  echo "  modules.define(\"$$module\", function(module, require) {" >> $(BROWSER_FILE_DEV); \
	  sed -e 's/^\(..*\)$$/    \1/' lib/$$module.js                     >> $(BROWSER_FILE_DEV); \
	  echo '  });'                                                      >> $(BROWSER_FILE_DEV); \
	  echo ''                                                           >> $(BROWSER_FILE_DEV); \
	done

	echo '  var PEG = modules["peg"];' 									>> $(BROWSER_FILE_DEV)
	echo '  PEG.__require__ = __require__;'                             >> $(BROWSER_FILE_DEV)
	echo '  PEG.__modules__ = modules;'                                 >> $(BROWSER_FILE_DEV)
	echo '  return PEG;'               									>> $(BROWSER_FILE_DEV)
	echo '})();'                       									>> $(BROWSER_FILE_DEV)

	$(UGLIFYJS)                 \
	  --mangle                  \
	  --compress warnings=false \
	  --comments /Copyright/    \
	  -o $(BROWSER_FILE_MIN)    \
	  $(BROWSER_FILE_DEV)

# Remove browser version of the library (created by "browser")
browserclean:
	rm -rf $(BROWSER_DIR)

# Run the spec suite
spec: parser
	$(JASMINE_NODE) --verbose $(SPEC_DIR)

# Run the benchmark suite
benchmark-all:								\
			benchmark 						\
			benchmark-cache 				\
			benchmark-locinfo 				\
			benchmark-cache-locinfo 		\
			benchmark-size 					\
			benchmark-size-cache 			\
			benchmark-size-locinfo 			\
			benchmark-size-cache-locinfo 

benchmark: parser
	$(BENCHMARK_RUN)

benchmark-cache: parser
	$(BENCHMARK_RUN) --cache

benchmark-locinfo: parser
	$(BENCHMARK_RUN) --includeRegionInfo

benchmark-cache-locinfo: parser
	$(BENCHMARK_RUN) --cache --includeRegionInfo

benchmark-size: parser
	$(BENCHMARK_RUN) --optimize size

benchmark-size-cache: parser
	$(BENCHMARK_RUN) --cache --optimize size

benchmark-size-locinfo: parser
	$(BENCHMARK_RUN) --includeRegionInfo --optimize size

benchmark-size-cache-locinfo: parser
	$(BENCHMARK_RUN) --cache --includeRegionInfo --optimize size

# Run JSHint on the source
hint: parser
	$(JSHINT)                                                                \
	  `find $(LIB_DIR) -name '*.js'`                                         \
	  `find $(SPEC_DIR) -name '*.js' -and -not -path '$(SPEC_DIR)/vendor/*'` \
	  $(BENCHMARK_DIR)/*.js                                                  \
	  $(BENCHMARK_RUN)                                                       \
	  $(PEGJS)

.PHONY:  all parser browser browserclean spec benchmark hint
.SILENT: all parser browser browserclean spec benchmark hint
