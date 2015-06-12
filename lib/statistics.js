var arrays = require("./utils/arrays");
var visitor = require("./compiler/visitor");

var statistics = {
  // a very tiny compiler pass which will check the annotations against the parser options:
  prepWork: function (ast, options) {
    var collector = options.collector;

    // and also see whether we have a `@collect_statistics` annotation somewhere...
    function visitAnnotation(annotation, parent_annotation, node, parent) { 
      if (annotation.name === 'collect_statistics') {
        options.collectRunTimeStatistics = 1;
      }
    }
    
    var patch = visitor.build({
      annotation: visitAnnotation
    });

    patch(ast);
  },

  report: function(stats, options) {
    var f, slen, ruleInfo, ruleName, unused, maxNameLen, columns, c, item, colwidth, bla, visitsArr;
    var displayWidth = 120;

    function padRight(str, width, tail) {
      str = '' + str;
      width = width || 6;
      var len = str.length;
      width -= len;
      if (width > 0) {
        tail = tail || ' ';
        var a = new Array(width);
        str += ' ' + a.join(tail);
      }
      return str;
    }

    function padRightKillZero(lead, value, tail, start) {
      start = start || ', ';
      lead = lead || '';
      if (lead.length) {
        lead += ': ';
      }
      tail = tail || '';
      //SAMPLE: var str = ', quiet: ' + padRight(ruleInfo.silentFail + ')'); 
      var str = start + lead + padRight(value + tail);
      if (parseFloat(value) === 0) {
        var slen = str.length - start.length - tail.length;
        str = start + padRight('----' + tail, slen);
      }
      return str;
    }

    // dump list of names in dynamic multi-column table.
    function dumpNamesList(arr, indentStr) {
      var minGap = 3;
      var maxWidth = 1;
      for (var f = 0, slen = arr.length; f < slen; f++) {
        var name = arr[f];
        maxWidth = Math.max(maxWidth, name.length);
      }
      var columns = Math.max(1, Math.floor((displayWidth - indentStr.length) / maxWidth));
      columns = Math.max(1, Math.floor((displayWidth - indentStr.length - columns * minGap + minGap) / maxWidth));
      var colwidth = Math.floor((displayWidth - indentStr.length - columns * minGap + minGap) / columns);
      colwidth += minGap;

      arr.sort();

      var rv = [];
      var bla = [];
      var c = 1;
      for (f = 0, slen = arr.length; f < slen; f++, c++) {
        if (c % columns) {
          bla.push(padRight(arr[f], colwidth));
        } else {
          // last column!
          bla.push(arr[f]);
          rv.push(indentStr + bla.join(' '));
          bla = [];
        }
      }
      if (bla.length) {
        // dump remainder on last line too
        rv.push(indentStr + bla.join(' '));
      }
      return rv;
    }

    function reportParentVisits(ruleInfo, indentStr) {
      var rv = [];
      var parents = [];
      var noParents = [];

      arrays.each(ruleInfo.visitingParent, function (p, i) {
        var name = stats.rulenames[i];
        if (p.visit + p.cacheHit) {
          p.ruleName = name;
          parents.push(p);
        } else {
          noParents.push(name);
        }
      });

      parents.sort(function (a, b) {
        var rv = b.visit - a.visit;
        if (!rv) {
          rv = b.cacheHit - a.cacheHit;
        }
        return rv;
      });

      arrays.each(parents, function (p) {
        rv.push(
          indentStr + padRight(p.ruleName, maxNameLen, '.') + ': ' + p.visit + ' / ' + (p.cacheHit ? p.cacheHit : '--')
        );
      });

      if (0) {
        rv.push(indentStr + '------');

        rv = arrays.merge(rv, dumpNamesList(noParents, indentStr));
      }
      return rv;
    }
    
    if (options.collectRunTimeStatistics) {
      console.log("### Run-time Cache Hit Statistics: rules which used the cache:");

      maxNameLen = 1;
      arrays.each(stats.rulenames, function (s) {
        maxNameLen = Math.max(maxNameLen, s.length);
      });

      visitsArr = stats.counters.slice(0);
      for (f = 0, slen = stats.counters.length; f < slen; f++) {
        visitsArr[f].ruleName = stats.rulenames[f];
        visitsArr[f].hasMemoization = stats.hasMemoization[f];
      } 
      // Order the statistics by number of visits to the rule, most visits first.
      // Equal number of visits get ordered by fail return count from high to low (i.e. worst ones first).
      visitsArr.sort(function(a, b) {
        var rv = b.visit - a.visit;
        if (!rv) {
          rv = b.returnFail - a.returnFail;
        }
        return rv;
      });
      
      for (f = 0, slen = visitsArr.length; f < slen; f++) {
        ruleInfo = visitsArr[f];
        if (ruleInfo.visit) {
          var parts = arrays.merge([
            '  ' + ruleInfo.ruleName + ':',
            '    visits: ' + padRight(ruleInfo.visit, 20) + 
            (ruleInfo.cacheHit === 0 ? 
              (ruleInfo.hasMemoization ? 
                '    --no memo cache hit' + (ruleInfo.hasMemoization > 1 ? ' (mode: ' + ruleInfo.hasMemoization + ')' : '') + '--' : 
                '    ~~ memoization OFF ~~'
              ) :
              '    memo cache hits: ' + ruleInfo.cacheHit
            )
          ], (ruleInfo.visit ? reportParentVisits(ruleInfo, '      ') : null), [
            '    fail: ' + ((ruleInfo.fail + ruleInfo.silentFail + ruleInfo.pushedFail + ruleInfo.returnFail + ruleInfo.returnSilentFail + ruleInfo.returnCachedFail + ruleInfo.returnCachedSilentFail) === 0 ?
                            '--none--' :
                            padRightKillZero('', ruleInfo.returnFail, '', '') + 
                              padRightKillZero('predicate', ruleInfo.returnSilentFail) + 
                              padRightKillZero('memo', ruleInfo.returnCachedFail) + 
                              padRightKillZero('pred-memo', ruleInfo.returnCachedSilentFail) + 
                              padRightKillZero('(state', ruleInfo.fail) + 
                              padRightKillZero('quiet', ruleInfo.silentFail, ')') + 
                              padRightKillZero('push', ruleInfo.pushedFail) + 
                              padRightKillZero('F%', (100 * ruleInfo.returnFail / Math.max(1, ruleInfo.visit)).toFixed(1).replace(".0", "")) + 
                              padRightKillZero('Pred%', (100 * ruleInfo.returnSilentFail / Math.max(1, ruleInfo.visit)).toFixed(1).replace(".0", "")) + 
                            ''),
          ]).join("\n");
          console.log(parts);
        }
      }
      console.log("\n### Run-time Cache Hit Statistics: rules which were not used:");
      unused = [];
      for (f = 0, slen = visitsArr.length; f < slen; f++) {
        ruleInfo = visitsArr[f];
        if (!ruleInfo.visit) {
          unused.push(ruleInfo.ruleName);
        }
      }
      
      console.log(dumpNamesList(unused, '  ').join("\n"));
    }
  } 
};

module.exports = statistics;
