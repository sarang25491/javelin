/**
 * @provides javelin-uri
 * @requires javelin-install
 *           javelin-util
 *           javelin-stratcom
 *
 * @javelin-installs JX.$U
 *
 * @javelin
 */

/**
 * Handy convenience function that returns a @{class:JX.URI} instance. This
 * allows you to write things like:
 *
 *   JX.$U('http://zombo.com/').getDomain();
 *
 * @param string            Unparsed URI.
 * @return  @{class:JX.URI} JX.URI instance.
 *
 * @group uri
 */
JX.$U = function(uri) {
  return new JX.URI(uri);
};

/**
 * Convert a string URI into a maleable object.
 *
 *   var uri = new JX.URI('http://www.example.com/asdf.php?a=b&c=d#anchor123');
 *   uri.getProtocol();    // http
 *   uri.getDomain();      // www.example.com
 *   uri.getPath();        // /asdf.php
 *   uri.getQueryParams(); // {a: 'b', c: 'd'}
 *   uri.getFragment();    // anchor123
 *
 * ...and back into a string:
 *
 *   uri.setFragment('clowntown');
 *   uri.toString() // http://www.example.com/asdf.php?a=b&c=d#clowntown
 *
 * @group uri
 */
JX.install('URI', {
  statics : {
    _uriPattern : /(?:([^:\/?#]+):)?(?:\/\/([^:\/?#]*)(?::(\d*))?)?([^?#]*)(?:\?([^#]*))?(?:#(.*))?/,
    _queryPattern : /(?:^|&)([^&=]*)=?([^&]*)/g,

    /**
     *  Convert a Javascript object into an HTTP query string.
     *
     *  @param  Object  Map of query keys to values.
     *  @return String  HTTP query string, like 'cow=quack&duck=moo'.
     */
    _defaultQuerySerializer : function(obj) {
      var kv_pairs = [];
      for (var key in obj) {
        if (obj[key] != null) {
          var value = encodeURIComponent(obj[key]);
          kv_pairs.push(encodeURIComponent(key) + (value ? '=' + value : ''));
        }
      }

      return kv_pairs.join('&');
    }

  },

  /**
   * Construct a URI
   *
   * Accepts either absolute or relative URIs. Relative URIs may have protocol
   * and domain properties set to undefined
   *
   * @param string    absolute or relative URI
   */
  construct : function(uri) {
    // need to set the default value here rather than in the properties map,
    // or else we get some crazy global state breakage
    this.setQueryParams({});

    if (uri) {
      // parse the url
      var result = JX.URI._uriPattern.exec(uri);

      this.setProtocol(result[1]);
      this.setDomain(result[2]);
      this.setPort(result[3]);
      var path = result[4];
      var query = result[5];
      this.setFragment(result[6]);

      // parse the path
      this.setPath(path.charAt(0) == '/' ? path : '/' + path);

      // parse the query data
      if (query) {
        var queryData = {};
        var data;
        while ((data = JX.URI._queryPattern.exec(query)) != null) {
          queryData[decodeURIComponent(data[1].replace(/\+/g, ' '))] =
            decodeURIComponent(data[2].replace(/\+/g, ' '));
        }
        this.setQueryParams(queryData);
      }
    }
  },

  properties : {
    protocol: undefined,
    domain: undefined,
    port: undefined,
    path: undefined,
    queryParams: undefined,
    fragment: undefined,
    querySerializer: undefined
  },

  members : {

    /**
     * Append and override query data values
     * Remove a query key by setting it undefined
     *
     * @param map
     * @return @{JX.URI} self
     */
    addQueryParams : function(map) {
      JX.copy(this.getQueryParams(), map);
      return this;
    },

    /**
     * Set a specific query parameter
     * Remove a query key by setting it undefined
     *
     * @param string
     * @param wild
     * @return @{JX.URI} self
     */
    setQueryParam : function(key, value) {
      var map = {};
      map[key] = value;
      return this.addQueryParams(map);
    },

    toString : function() {
      if (__DEV__) {
        if (this.getPath() && this.getPath().charAt(0) != '/') {
          throw new Error(
            'JX.URI.toString(): ' +
            'Path does not begin with a "/" which means this URI will likely' +
            'be malformed. Ensure any string passed to .setPath() leads "/"');
        }
      }
      var str = '';
      if (this.getProtocol()) {
        str += this.getProtocol() + '://';
      }
      str += this.getDomain() || '';

      // If there is a domain or a protocol, we need to provide '/' for the
      // path. If we don't have either and also don't have a path, we can omit
      // it to produce a partial URI without path information which begins
      // with "?", "#", or is empty.
      str += this.getPath() || (str ? '/' : '');

      str += this._getQueryString();
      if (this.getFragment()) {
        str += '#' + this.getFragment();
      }
      return str;
    },

    _getQueryString : function() {
      var str = (
        this.getQuerySerializer() || JX.URI._defaultQuerySerializer
      )(this.getQueryParams());
      return str ? '?' + str : '';
    },

    /**
     * Redirect the browser to another page by changing the window location. If
     * the URI is empty, reloads the current page.
     *
     * You can install a Stratcom listener for the 'go' event if you need to log
     * or prevent redirects.
     *
     * @return void
     */
    go : function() {
      var uri = this.toString();
      if (JX.Stratcom.invoke('go', null, {uri: uri}).getPrevented()) {
        return;
      }
      (uri && (window.location = uri)) || window.location.reload(true);
    }

  }
});
