/* Class utilities */
var classes = {
  subclass: function(child, parent) {
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
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
