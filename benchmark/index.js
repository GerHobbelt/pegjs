$("#run").click(function() {

  /* Results Table Manipulation */

  var resultsTable = $("#results-table");

  function appendHeading(heading) {
    resultsTable.append(
      "<tr class='heading'><th colspan='4'>" + heading + "</th></tr>"
    );
  }

  function appendFailureMessage(report) {
    resultsTable.append(
      "<tr class='failure'><td colspan='4'><pre>" + report + "</pre></td></tr>"
    );
  }

  function appendResult(klass, title, url, inputSize, parseTime) {
    var KB      = 1024,
        MS_IN_S = 1000;

    resultsTable.append(
        "<tr class='" + klass + "'>"
      +   "<td class='title'>"
      +     (url !== null ? "<a href='" + url + "'>" : "")
      +       title
      +     (url !== null ? "</a>" : "")
      +   "</td>"
      +   "<td class='input-size'>"
      +     "<span class='value'>"
      +       (inputSize / KB).toFixed(2)
      +     "</span>"
      +     "&nbsp;<span class='unit'>kB</span>"
      +   "</td>"
      +   "<td class='parse-time'>"
      +     "<span class='value'>"
      +       parseTime.toFixed(2)
      +     "</span>"
      +     "&nbsp;<span class='unit'>ms</span>"
      +   "</td>"
      +   "<td class='parse-speed'>"
      +     "<span class='value'>"
      +       ((inputSize / KB) / (parseTime / MS_IN_S)).toFixed(2)
      +     "</span>"
      +     "&nbsp;<span class='unit'>kB/s</span>"
      +   "</td>"
      + "</tr>"
    );
  }

  /* Main */

  /*
   * Each input is parsed multiple times and the results are averaged. We
   * do this for two reasons:
   *
   *   1. To warm up the interpreter (PEG.js-generated parsers will be
   *      most likely used repeatedly, so it makes sense to measure
   *      performance after warming up).
   *
   *   2. To minimize random errors.
   */

  var runCount = parseInt($("#run-count").val(), 10),
      options  = {
        cache:              $("#cache").is(":checked"),
        includeRegionInfo:  $("#region").is(":checked"),
        optimize:           $("#optimize").val()
      };

  if (isNaN(runCount) || runCount <= 0) {
    alert("Number of runs must be a positive integer.");
    return;
  }

  Runner.run(benchmarks, runCount, options, {
    readFile: function(file) {
      return $.ajax({
        type:     "GET",
        url:      file,
        dataType: "text",
        async:    false
      }).responseText;
    },

    testStart: function(benchmark, test, state) {
      /* Nothing to do. */
    },

    testOneRound: function(benchmark, test, iterationIndex, parseTime, state) {
      /* Nothing to do. */
    },

    testFinish: function(benchmark, test, inputSize, parseTime, state) {
      var title = test.title;

      if (state.testFailCollection.length > 0) {
        // grab the first failure and report it:
        var firstFailure = state.testFailCollection[0];

        title += " !FAILED!";

        var ex = firstFailure.failure;
        var errMsg = ex.message;
        var locInfo = "";
        if (ex.line || ex.column || ex.offset) {
          locInfo = " (line: " + ex.line + ", column: " + ex.column + " ~ offset: " + ex.offset + ")";
        }
        var errPreMsg = "";
        if (ex.name) {
          errPreMsg = ex.name + ": ";
        }
        var msg = errPreMsg + errMsg + locInfo;
        appendFailureMessage(msg.trim());
      }

      appendResult(
        "individual",
        title,
        benchmark.id + "/" + test.file,
        inputSize,
        parseTime
      );
    },

    benchmarkStart: function(benchmark, state) {
      appendHeading(benchmark.title);
    },

    benchmarkFinish: function(benchmark, inputSize, parseTime, state) {
      appendResult(
        "benchmark-total",
        benchmark.title + " total",
        null,
        inputSize,
        parseTime
      );
    },

    start: function(state) {
      $("#run-count, #cache, #run").attr("disabled", "disabled");

      resultsTable.show();
      $("#results-table tr").slice(1).remove();
    },

    finish: function(inputSize, parseTime, state) {
      appendResult(
        "total",
        "Total",
        null,
        inputSize,
        parseTime
      );

      $.scrollTo("max", { axis: "y", duration: 500 });

      $("#run-count, #cache, #run").removeAttr("disabled");
    }
  });

});

$(document).ready(function() {
  $("#run").focus();
});
