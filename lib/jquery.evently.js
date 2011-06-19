/**
 * Evently is a macro language for creating template based jQuery apps.
 * The strength of Evently is in making widgets that can easily be reused
 * between applications.
 */

/**
 * First, some utility functions.
 * $$ is inspired by @wycats: http://yehudakatz.com/2009/04/20/evented-programming-with-jquery/
 */
function $$(node) {
  var $node = $(node),
      data = $node.data('$$');

  if (!data) {
    $(node).data('$$', data = {});
  }

  return data;
};

(function($) {
  /**
   * Cross-browser $.log
   */
  if (window && window.console && window.console.log) {
    $.log = function() {
      window.console.log.apply(window.console, arguments);
    };
  } else {
    $.log = function() {};
  }

  /**
   * Iterate through object properties
   */
  $.forIn = function(obj, fun) {
    var name;
    for (name in obj) {
      if (obj.hasOwnProperty(name)) {
        fun(name, obj[name]);
      }
    }
  };

  /**
   * Convert `arguments` to Array
   */
  $.argsToArray = function(args) {
    return Array.prototype.slice.call(args);
  };

  /**
   * Replace function for render/ folder
   */
  $.fn.replace = function(elem) {
    $(this).empty().append(elem);
  };

  // Now, core evently helpers

  // this allows you to specify callbacks as functions or strings
  function evfun(fun, hint) {
    if (typeof fun === 'string' && /^function/.test(fun)) {
      eval('var f = ' + fun);
      if (typeof f === 'function') {
        return function() {
          try {
            var value = f.apply(this, arguments);
          } catch (e) {
            // IF YOU SEE AN ERROR HERE IT HAPPENED WHEN WE TRIED TO RUN YOUR FUNCTION
            $.log('Error in evently function');
            $.log(e.toString());
            $.log('src: %s, hint: %s', fun, hint);
            throw e;
          }

          // _init should not bubble
          if (hint === '_init') return false;

          return value;
        };
      }
    }
    return fun;
  };

  /**
   * Call fun if it's function and return
   * result or fun itself (if it was just a value
   */
  function rfun(me, fun, args) {
    var f = evfun(fun, me);

    return typeof f === 'function' ? f.apply(me, args) : fun;
  }

  /**
   * Extract events from ddoc.evently and ddoc.vendor.*.evently
   */
  function extractEvents(name, ddoc) {
    var events = [true, {}],
        vendor = ddoc.vendor || {},
        evently = ddoc.evently || {};

    $.forIn(vendor, function(k, v) {
      if (v.evently && v.evently[name]) {
        events.push(v.evently[name]);
      }
    });

    if (evently[name]) events.push(evently[name]);

    return $.extend.apply(null, events);
  }

  function applyCommon(events) {
    if (events._common) {
      $.forIn(events, function(k, v) {
        events[k] = $.extend(true, {}, events._common, v);
      });
      delete events._common;
    }
    return events;
  }

  /**
   * hApply applies the user's handler (h) to the
   * elem, bound to trigger based on name.
   */
  function hApply(elem, name, h, args) {
    if ($.isArray(h)) {
      for (var i=0; i < h.length; i++) {
        // handle arrays recursively
        hApply(elem, name, h[i], args);
      }
      return;
    }

    var f = evfun(h, name);

    if (typeof f === 'function') {
      elem.bind(name, {args: args}, f);
    } else if (typeof f === 'string') {
      // just trigger another event
      elem.bind(name, {args: args}, function() {
        $(this).trigger(f);
        return false;
      });
    } else {
      // an evently widget
      elem.bind(name, {args: args}, function() {
        react($(this), h, arguments);
        return false;
      });
    }
  };

  function react(me, h, args, ran) {
    var fun,
        name,
        before = $.evently.fn.before;

    ran || (ran = {});

    for (name in before) {
      if (before.hasOwnProperty(name)) {
        if (h[name] && !ran[name]) {
          ran[name] = true;

          before[name].apply(me, [h, function() {
            var _args = $.argsToArray(arguments)
                         .concat($.argsToArray(args));

            react(me, h, _args, ran);
          }, args]);

          return;
        }
      }
    }

    /**
     * result of running multiple render engines is undefined
     * currently the default renderer is mustache
     */

    var rendered;
    $.forIn($.evently.fn.render, function(name, fun) {
      if (h[name]) {
        rendered = fun.apply(me, [h, args]);
      }
    });

    // the after callbacks, like selectors.
    $.forIn($.evently.fn.after, function(name, fun) {
      if (h[name]) {
        fun.apply(me, [h, rendered, args]);
      }
    });
  };

  function processEvs(elem, events, app) {
    // store the app on the element for later use
    if (app) $$(elem).app = app;

    if (typeof events === 'string') {
      events = extractEvents(events, app.ddoc);
    }

    events = applyCommon(events);
    $$(elem).evently = events;

    if (app && app.ddoc) {
      $$(elem).partials = extractEvents('_partials', app.ddoc);
    }

    return events;
  };


  /**
   * The public API
   */
  $.fn.evently = function(events, app, args) {
    var elem = $(this);

    events = processEvs(elem, events, app);
    // setup the handlers onto elem
    $.forIn(events, function(name, h) {
      hApply(elem, name, h, args);
    });

    // the after callbacks, like selectors.
    $.forIn($.evently.fn.setup, function(name, fun) {
      if (events[name]) {
        fun.apply(elem, [events[name], args]);
      }
    });

    return this;
  };

  $.evently = {
    connect : function(source, target, events) {
      events.forEach(function(ev) {
        $(source).bind(ev, function() {
          var args = $.makeArray(arguments),
              e1 = args.shift();

          args.push(e1);
          $(target).trigger(ev, args);

          return false;
        });
      });
    },
    paths : [],
    changesDBs : {},
    changesOpts : {},
    utils : {
      rfun : rfun,
      evfun : evfun
    },
    fn : {
      setup : {},
      before : {},
      render : {},
      after : {}
    }
  };

})(jQuery);

/**
 * plugin system
 * $.evently.handlers
 * _init, _changes
 */
(function($) {
  $.evently.fn.setup._init = function(ev, args) {
    this.trigger('_init', args);
  };
})(jQuery);

/**
 * before plugin
 */
(function($) {
  $.evently.fn.before.before = function(h, cb, args) {
    $.evently.utils.evfun(h.before, this).apply(this, args);
    cb()
  };
})(jQuery);

/**
 * async plugin
 */
(function($) {
  $.evently.fn.before.async = function(h, cb, args) {
    $.evently.utils
             .evfun(h.async, this)
             .apply(this,
                    [cb].concat($.argsToArray(args))
                   );
  };
})(jQuery);

/**
 * Mustache plugin
 */
(function($) {
  var rfun = $.evently.utils.rfun;

  function mustachioed(me, h, args) {
    // global partials stored by processEvs()
    var partials = $$(me).partials;

    return $($.mustache(
              rfun(me, h.mustache, args),
              rfun(me, h.data, args),
              rfun(me, $.extend(true, partials,
                                h.partials), args)
            ));
  };

  $.evently.fn.render.mustache = function(h, args) {
    var render = (h.render || 'replace').replace(/\s/g, ''),
        newElem = mustachioed(this, h, args);

    this[render](newElem);

    return newElem;
  };
})(jQuery);

/**
 * Selectors plugin applies Evently to nested elements
 */
(function($) {
  $.evently.fn.after.selectors = function(h, rendered, args) {
    var render = (h.render || 'replace').replace(/\s/g, ''),
        el = this,
        app = $$(el).app,
        root = render === 'replace' ? el : rendered,
        selectors = $.evently.utils.rfun(el, h.selectors, args);

    $.forIn(selectors, function(selector, handlers) {
      $(selector, root).evently(handlers, app, args);
    });
  };
})(jQuery);

/**
 * plugin to run the after callback
 */
(function($) {
  $.evently.fn.after.after = function(h, rendered, args) {
    $.evently.utils.rfun(this, h.after, args);
  };
})(jQuery);
