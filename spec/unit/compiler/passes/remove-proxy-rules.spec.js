/* global describe, expect, it, beforeEach */

"use strict";

var PEG = require("../../../../lib/peg.js");

var specTestCollector = {
  emitFatalError: function(message, extra_info) {
    throw new GrammarError("fatal:" + message, extra_info);
  },
  emitError: function(message, extra_info) {
    throw new GrammarError("error:" + message, extra_info);
  },
  emitWarning: function(message, extra_info) {
    console.log("warning: " + message, extra_info);
  },
  emitInfo: function(message, extra_info) {
    console.log("info: " + message, extra_info);
  }
};

describe("compiler pass |removeProxyRules|", function() {
  var pass = PEG.compiler.passes.transform.removeProxyRules;

  beforeEach(function() {
    this.addMatchers(require("./helpers.js"));
  });

  describe("when a proxy rule isn't listed in |allowedStartRules|", function() {
    it("updates references and removes it", function() {
      expect(pass).toChangeAST(
        [
          'start = proxy',
          'proxy = proxied',
          'proxied = "a"'
        ].join("\n"),
        { 
          allowedStartRules: ["start"],
          collector: specTestCollector 
        },
        {
          rules: [
            {
              name:       "start",
              expression: { type: "rule_ref", name: "proxied" }
            },
            { name: "proxied" }
          ]
        }
      );
    });
  });

  describe("when a proxy rule is listed in |allowedStartRules|", function() {
    it("updates references but doesn't remove it", function() {
      expect(pass).toChangeAST(
        [
          'start = proxy',
          'proxy = proxied',
          'proxied = "a"'
        ].join("\n"),
        { 
          allowedStartRules: ["start", "proxy"],
          collector: specTestCollector 
        },
        {
          rules: [
            {
              name:       "start",
              expression: { type: "rule_ref", name: "proxied" }
            },
            {
              name:       "proxy",
              expression: { type: "rule_ref", name: "proxied" }
            },
            { name: "proxied" }
          ]
        }
      );
    });
  });
});
