Runner = {
  run: function(benchmarks, runnerOptions, options, callbacks) {

    // Fix the minimumRunTime to a sensible value: >= 100 msecs
    runnerOptions.minimumRunTime = Math.max(runnerOptions.minimumRunTime || 1, 100);

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
     *   1. To avoid browser mechanism for interrupting long-running scripts to
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
      state.totalTestFailCount = 0;

      callbacks.start(state);

      if (0 < benchmarks.length) {
        Q.add(benchmarkInitializer(0));
      } else {
        Q.add(finalize);
      }
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

        if (0 < benchmarks[i].tests.length) {
          Q.add(testRunnerStart(i, 0));
        } else {
          Q.add(benchmarkFinalizer(i));
        }
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
        state.testFailCollection = [];

        callbacks.testStart(benchmark, test, state);

        if (0 < runnerOptions.runCount) {
          Q.add(testRunnerSingleRun(i, j, 0));
        } else {
          Q.add(testRunnerFinish(i, j));
        }
      };
    }

    function testRunnerSingleRun(i, j, k) {
      // Fix the single timeslot to something sensible yet sub-second: 100..250 msecs
      var oneRunTimeThreshold = Math.min(250, runnerOptions.minimumRunTime);

      function execOne(n) {
        n = n || 1;
        var i;
        for (i = 0; i < n; i++) {
          try {
            state.parser.parse(state.testInput);
          } catch (ex) {
            exMsg = ex;
            state.testFailCollection.push({
              benchmark: i,
              test: j,
              round: k,
              failure: exMsg
            });
          }
        }
        return i;
      }

      return function() {
        var benchmark = benchmarks[i];
        var test = benchmark.tests[j];
        var exMsg = false;

        var t = (new Date()).getTime();
        var t_done = execOne(1);
        var t_delta = (new Date()).getTime() - t;

        // Heuristic: if the testrun was very fast (< 250 msec) then we execute
        // multiple rounds at once!
        //
        // Note:
        //
        // We also realize that we include a bit of 'overhead code' inside the test
        // timeframe, but this stuff is very fast so we're fine with it, given the
        // accuracy of the entire test.
        while (t_delta < oneRunTimeThreshold) {
          var t1 = Math.max(t_delta, 10);
          var t_count = Math.floor(oneRunTimeThreshold * t_done / t1);
          
          t_done += execOne(t_count - t_done);

          t_delta = (new Date()).getTime() - t;
          //console.log("single run count adjusted: ", t_done, ", time spent: ", t_delta);
        }
        state.singleRunParseTime[k] = t_delta / t_done;
        state.testParseTime += t_delta;
        state.runCount += t_done;
        callbacks.testOneRound(benchmark, test, k, t_delta / t_done, state);

        k++;
        if (state.runCount < runnerOptions.runCount || state.testParseTime < runnerOptions.minimumRunTime) {
          Q.add(testRunnerSingleRun(i, j, k));
        } else {
          Q.add(testRunnerFinish(i, j));
        }
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

        j++;
        if (j < benchmarks[i].tests.length) {
          Q.add(testRunnerStart(i, j));
        } else {
          Q.add(benchmarkFinalizer(i));
        }
      };
    }

    function benchmarkFinalizer(i) {
      return function() {
        state.totalInputSize += state.benchmarkInputSize;
        state.totalParseTime += state.benchmarkParseTime;

        if (state.testFailCollection.length > 0) {
          state.totalTestFailCount++;
        }

        callbacks.benchmarkFinish(
          benchmarks[i],
          state.benchmarkInputSize,
          state.benchmarkParseTime,
          state
        );

        state.parser = null;

        i++;
        if (i < benchmarks.length) {
          Q.add(benchmarkInitializer(i));
        } else {
          Q.add(finalize);
        }
      };
    }

    function finalize() {
      callbacks.finish(state.totalInputSize, state.totalParseTime, state);
    }

    /* Main */

    Q.add(initialize);
/*
    for (i = 0; i < benchmarks.length; i++) {
      Q.add(benchmarkInitializer(i));
      for (j = 0; j < benchmarks[i].tests.length; j++) {
        Q.add(testRunnerStart(i, j));
        for (var k = 0; k < runnerOptions.runCount; k++) {
          Q.add(testRunnerSingleRun(i, j, k));
        }
        Q.add(testRunnerFinish(i, j));
      }
      Q.add(benchmarkFinalizer(i));
    }
    Q.add(finalize);
*/

    Q.run();
  }
};
