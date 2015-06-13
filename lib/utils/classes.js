"use strict";

/* Class utilities */
var classes = {
  /**
   * Declare that a child class inherit it's prototype from the parent class.
   *
   * @public
   * @param {Function} child
   * @param {Function} parent
   */
  subclass: function(child, parent) {
    function Ctor() {}
    Ctor.prototype = parent.prototype;
    child.prototype = new Ctor();
    child.prototype.constructor = child;
  },

  // http://stackoverflow.com/questions/1606797/use-of-apply-with-new-operator-is-this-possible
  construct: function(constructor, args) {
    function F() {
      return constructor.apply(this, args);
    }
    F.prototype = constructor.prototype;
    return new F();
  }
};

module.exports = classes;
