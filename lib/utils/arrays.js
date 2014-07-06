/* Array utilities. */
var arrays = {
  range: function(start, stop) {
    var length = stop - start,
        result = new Array(length),
        i, j;

    for (i = 0, j = start; i < length; i++, j++) {
      result[i] = j;
    }

    return result;
  },

  find: function(array, valueOrPredicate) {
    array = array || [];
    var length = array.length, i;

    if (typeof valueOrPredicate === "function") {
      for (i = 0; i < length; i++) {
        if (valueOrPredicate.call(array, array[i], i)) {
          return array[i];
        }
      }
    } else {
      for (i = 0; i < length; i++) {
        if (array[i] === valueOrPredicate) {
          return array[i];
        }
      }
    }
  },

  indexOf: function(array, valueOrPredicate) {
    array = array || [];
    var length = array.length, i;

    if (typeof valueOrPredicate === "function") {
      for (i = 0; i < length; i++) {
        if (valueOrPredicate(array[i])) {
          return i;
        }
      }
    } else {
      for (i = 0; i < length; i++) {
        if (array[i] === valueOrPredicate) {
          return i;
        }
      }
    }

    return -1;
  },

  contains: function(array, valueOrPredicate) {
    return arrays.indexOf(array, valueOrPredicate) !== -1;
  },

  each: function(array, iterator) {
    array = array || [];
    var length = array.length, i;

    for (i = 0; i < length; i++) {
      iterator(array[i], i);
    }
  },

  map: function(array, iterator) {
    array = array || [];
    var length = array.length,
        result = new Array(length),
        i;

    for (i = 0; i < length; i++) {
      result[i] = iterator(array[i], i);
    }

    return result;
  },

  filter: function(array, condition) {
    array = array || [];
    var result = [];
    var length = array.length;
    var j = 0;
    for (var i = 0; i < length; i++) {
      if (condition(array[i], i)) {
        result[j] = array[i];
        ++j;
      }
    }
    return result;
  },

  pluck: function(array, key) {
    return arrays.map(array, function (e) { 
      return e[key]; 
    });
  },

  // Merge N arrays into one, where all elements are concatenated in order.
  //
  // Return the resulting array.
  //
  // Notes: 
  // - the returned array is a *shallow* clone.
  // - this function is identical to the helper function included in the PEGjs grammar `mergeArrays`.
  merge: function (array1 /* , ... */ ) {
    var arr = Array.prototype.slice.call(arguments, 0);

    for (var i = 0, len = arr.length; i < len; i++) {
      arr[i] = arr[i] || [];
    }
    return Array.prototype.concat.apply([], arr);
  }
};

module.exports = arrays;
