/**
 * @requires javelin-dom
 *           javelin-util
 *           javelin-stratcom
 *           javelin-install
 * @provides javelin-tokenizer
 * @javelin
 */

/**
 * A tokenizer is a UI component similar to a text input, except that it
 * allows the user to input a list of items ("tokens"), generally from a fixed
 * set of results. A familiar example of this UI is the "To:" field of most
 * email clients, where the control autocompletes addresses from the user's
 * address book.
 *
 * @{JX.Tokenizer} is built on top of @{JX.Typeahead}, and primarily adds the
 * ability to choose multiple items.
 *
 * To build a @{JX.Tokenizer}, you need to do four things:
 *
 *  1. Construct it, padding a DOM node for it to attach to. See the constructor
 *     for more information.
 *  2. Build a {@JX.Typeahead} and configure it with setTypeahead().
 *  3. Configure any special options you want.
 *  4. Call start().
 *
 * If you do this correctly, the input should suggest items and enter them as
 * tokens as the user types.
 */
JX.install('Tokenizer', {
  construct : function(containerNode) {
    this._containerNode = containerNode;
  },

  properties : {
    limit : null,
    nextInput : null
  },

  members : {
    _containerNode : null,
    _root : null,
    _focus : null,
    _orig : null,
    _typeahead : null,
    _tokenid : 0,
    _tokens : null,
    _tokenMap : null,
    _initialValue : null,
    _seq : 0,
    _lastvalue : null,

    start : function() {
      if (__DEV__) {
        if (!this._typeahead) {
          throw new Error(
            'JX.Tokenizer.start(): ' +
            'No typeahead configured! Use setTypeahead() to provide a ' +
            'typeahead.');
        }
      }

      this._orig = JX.DOM.find(this._containerNode, 'input', 'tokenizer-input');
      this._tokens = [];
      this._tokenMap = {};

      var focus = this.buildInput(this._orig.value);
      this._focus = focus;

      var input_container = JX.DOM.scry(
        this._containerNode,
        'div',
        'tokenizer-input-container'
      );
      input_container = input_container[0] || this._containerNode;

      JX.DOM.listen(
        focus,
        ['click', 'focus', 'blur', 'keydown', 'keypress'],
        null,
        JX.bind(this, this.handleEvent));

      JX.DOM.listen(
        input_container,
        'click',
        null,
        JX.bind(
          this,
          function(e) {
            if (e.getNode('remove')) {
              this._remove(e.getNodeData('token').key);
            } else if (e.getTarget() == this._root) {
              this.focus();
            }
          }));

      var root = JX.$N('div');
      root.id = this._orig.id;
      JX.DOM.alterClass(root, 'jx-tokenizer', true);
      root.style.cursor = 'text';
      this._root = root;

      root.appendChild(focus);

      var typeahead = this._typeahead;
      typeahead.setInputNode(this._focus);
      typeahead.start();

      JX.defer(
        JX.bind(
          this,
          function() {
            var container = this._orig.parentNode;
            JX.DOM.setContent(container, root);
            var map = this._initialValue || {};
            for (var k in map) {
              this.addToken(k, map[k]);
            }
            JX.DOM.appendContent(
              root,
              JX.$N('div', {style: {clear: 'both'}})
            );
            this._redraw();
          }));
    },

    setInitialValue : function(map) {
      this._initialValue = map;
      return this;
    },

    setTypeahead : function(typeahead) {

      typeahead.setAllowNullSelection(false);
      typeahead.removeListener();

      typeahead.listen(
        'choose',
        JX.bind(this, function(result) {
          JX.Stratcom.context().prevent();
          if (this.addToken(result.rel, result.name)) {
            if (this.shouldHideResultsOnChoose()) {
              this._typeahead.hide();
            }
            this._focus.value = '';
            this._redraw();
            this.focus();
          }
        })
      );

      typeahead.listen(
        'query',
        JX.bind(
          this,
          function(query) {

          // TODO: We should emit a 'query' event here to allow the caller to
          // generate tokens on the fly, e.g. email addresses or other freeform
          // or algorithmic tokens.

          // Then do this if something handles the event.
          // this._focus.value = '';
          // this._redraw();
          // this.focus();

          if (query.length) {
            // Prevent this event if there's any text, so that we don't submit
            // the form (either we created a token or we failed to create a
            // token; in either case we shouldn't submit). If the query is
            // empty, allow the event so that the form submission takes place.
            JX.Stratcom.context().prevent();
          }
        }));

      this._typeahead = typeahead;

      return this;
    },

    shouldHideResultsOnChoose : function() {
      return true;
    },

    handleEvent : function(e) {

      this._typeahead.handleEvent(e);
      if (e.getPrevented()) {
        return;
      }

      if (e.getType() == 'click') {
        if (e.getTarget() == this._root) {
          this.focus();
          e.prevent();
          return;
        }
      } else if (e.getType() == 'keydown') {
        this._onkeydown(e);
      } else if (e.getType() == 'blur') {
        this._redraw();
      }
    },

    refresh : function() {
      this._redraw(true);
      return this;
    },

    _redraw : function(force) {
      var focus = this._focus;

      if (focus.value === this._lastvalue && !force) {
        return;
      }
      this._lastvalue = focus.value;

      var root  = this._root;
      var metrics = JX.DOM.textMetrics(
        this._focus,
        'jx-tokenizer-metrics');
      metrics.y = null;
      metrics.x += 24;
      metrics.setDim(focus);

      // This is a pretty ugly hack to force a redraw after copy/paste in
      // Firefox. If we don't do this, it doesn't redraw the input so pasting
      // in an email address doesn't give you a very good behavior.
      focus.value = focus.value;
    },

    addToken : function(key, value) {
      if (key in this._tokenMap) {
        return false;
      }

      var focus = this._focus;
      var root = this._root;
      var token = this.buildToken(key, value);

      this._tokenMap[key] = {
        value : value,
        key : key,
        node : token
      };
      this._tokens.push(key);

      root.insertBefore(token, focus);

      return true;
    },

    buildInput: function(value) {
      return JX.$N('input', {
        className: 'jx-tokenizer-input',
        type: 'text',
        value: value
      });
    },

    /**
     * Generate a token based on a key and value. The "token" and "remove"
     * sigils are observed by a listener in start().
     */
    buildToken: function(key, value) {
      var input = JX.$N('input', {
        type: 'hidden',
        value: key,
        name: this._orig.name + '[' + (this._seq++) + ']'
      });

      var remove = JX.$N('a', {
        className: 'jx-tokenizer-x',
        sigil: 'remove'
      }, '\u00d7'); // U+00D7 multiplication sign

      return JX.$N('a', {
        className: 'jx-tokenizer-token',
        sigil: 'token',
        meta: {key: key}
      }, [value, input, remove]);
    },

    getTokens : function() {
      var result = {};
      for (var key in this._tokenMap) {
        result[key] = this._tokenMap[key].value;
      }
      return result;
    },

    _onkeydown : function(e) {
      var focus = this._focus;
      var root = this._root;
      switch (e.getSpecialKey()) {
        case 'tab':
          var completed = this._typeahead.submit();
          if (this.getNextInput()) {
            if (!completed) {
              this._focus.value = '';
            }
            JX.defer(JX.bind(this, function() {
              this.getNextInput().focus();
            }));
          }
          break;
        case 'delete':
          if (!this._focus.value.length) {
            var tok;
            while (tok = this._tokens.pop()) {
              if (this._remove(tok)) {
                break;
              }
            }
          }
          break;
        case 'return':
          // Don't subject this to token limits.
          break;
        default:
          if (this.getLimit() &&
              JX.keys(this._tokenMap).length == this.getLimit()) {
            e.prevent();
          }
          JX.defer(JX.bind(this, this._redraw));
          break;
      }
    },

    _remove : function(index) {
      if (!this._tokenMap[index]) {
        return false;
      }
      JX.DOM.remove(this._tokenMap[index].node);
      delete this._tokenMap[index];
      this._redraw(true);
      this.focus();
      return true;
    },

    focus : function() {
      var focus = this._focus;
      JX.DOM.show(focus);
      JX.defer(function() { JX.DOM.focus(focus); });
    }
  }
});
