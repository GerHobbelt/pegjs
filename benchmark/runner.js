Runner = {
  run: function(benchmarks, runCount, options, callbacks) {

    /* Queue */

    var Q = {
          functions: [],

          add: function(f) {
            this.functions.push(f);
          },

          run: function() {
            if (this.functions.length > 0) {
              this.functions.shift()();

              /*
               * We can't use |arguments.callee| here because |this| would get
               * messed-up in that case.
               */
              setTimeout(function() { 
                Q.run(); 
              }, 1 /* do not use 0 delay but give user/observer in browser a slice of time too */);
            }
          }
        };

    /*
     * The benchmark itself is factored out into several functions (some of them
     * generated), which are enqueued and run one by one using |setTimeout|. We
     * do this for two reasons:
     *
     *   1. To avoid bowser mechanism for interrupting long-running scripts to
     *      kick-in (or at least to not kick-in that often).
     *
     *   2. To ensure progressive rendering of results in the browser (some
     *      browsers do not render at all when running JavaScript code).
     *
     * The enqueued functions share state, which is all stored in the properties
     * of the |state| object.
     */

    var state = {}, i, j;

    function initialize() {
      state.totalInputSize = 0;
      state.totalParseTime = 0;

      callbacks.start(state);
    }

    function benchmarkInitializer(i) {
      return function() {
        state.benchmarkInputSize = 0;
        state.benchmarkParseTime = 0;

        state.parser = PEG.buildParser(
          callbacks.readFile("../examples/" + benchmarks[i].id + ".pegjs"),
          options
        );

        callbacks.benchmarkStart(benchmarks[i], state);
      };
    }

    function testRunnerStart(i, j) {
      return function() {
        var benchmark = benchmarks[i],
            test      = benchmark.tests[j],
            input, parseTime, averageParseTime, k, t;

        state.testInput = callbacks.readFile(benchmark.id + "/" + test.file);
        state.singleRunParseTime = [];
        state.testParseTime = 0;
        state.runCount = 0;

        callbacks.testStart(benchmark, test, state);
      };
    }

    function testRunnerSingleRun(i, j, k) {
      return function() {
        var benchmark = benchmarks[i];
        var test = benchmark.tests[j];

        var t = (new Date()).getTime();
        state.parser.parse(state.testInput);
        var t_delta = (new Date()).getTime() - t;
        state.singleRunParseTime[k] = t_delta;
        state.testParseTime += t_delta;
        state.runCount++;
        callbacks.testOneRound(benchmark, test, k, t_delta, state);
      };
    }

    function testRunnerFinish(i, j) {
      return function() {
        var benchmark = benchmarks[i];
        var test = benchmark.tests[j];

        var averageParseTime = state.testParseTime / state.runCount;

        state.benchmarkInputSize += state.testInput.length;
        state.benchmarkParseTime += averageParseTime;

        callbacks.testFinish(benchmark, test, state.testInput.length, averageParseTime, state);
      };
    }

    function benchmarkFinalizer(i) {
      return function() {
        state.parser = null;

        state.totalInputSize += state.benchmarkInputSize;
        state.totalParseTime += state.benchmarkParseTime;

        callbacks.benchmarkFinish(
          benchmarks[i],
          state.benchmarkInputSize,
          state.benchmarkParseTime,
          state
        );
      };
    }

    function finalize() {
      callbacks.finish(state.totalInputSize, state.totalParseTime, state);
    }

    /* Main */

    Q.add(initialize);
    for (i = 0; i < benchmarks.length; i++) {
      Q.add(benchmarkInitializer(i));
      for (j = 0; j < benchmarks[i].tests.length; j++) {
        Q.add(testRunnerStart(i, j));
        for (var k = 0; k < runCount; k++) {
          Q.add(testRunnerSingleRun(i, j, k));
        }
        Q.add(testRunnerFinish(i, j));
      }
      Q.add(benchmarkFinalizer(i));
    }
    Q.add(finalize);

    Q.run();
  }
};
