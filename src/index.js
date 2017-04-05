/* global Ti, L */
// RFC for OAuth2: https://tools.ietf.org/html/rfc6749

// TODO Do we want to support OAuth 1.0? https://github.com/indieocean/Titanium-OAuth-Client/blob/master/titanium_oauth.js
// TODO Allow users to specify scopes when authorizing
const CALLBACK_URL = 'http://localhost/Callback'; //'urn:ietf:wg:oauth:2.0:oob' // FIXME can we redirect to some other URL scheme that won't show errors in console?
// TODO Allow users to modify the look and feel of the window that opens the webview for auth? really doesn't matter much...
// Only important one here is the title.
const AUTH_WINDOW_OPTIONS = {
	backgroundColor : 'white',
	translucent: false,
	title : 'OAuth Example'
};

const isiOS = Ti.Platform.osname == 'iphone' || Ti.Platform.osname == 'ipad';

/********** Helpers **********/
function buildURL(baseURL, params) {
	var encodedParams = [];

	for (var param in params) {
		if (params.hasOwnProperty(param)) {
			encodedParams.push(encodeURIComponent(param) + '=' + encodeURIComponent(params[param]));
		}
	}

	return baseURL + '?' + encodedParams.join('&');
}

/**
 * POSTS to a token endpoint and returns an OAuth object to the callback.
 *
 * @param  {String}   url	  The URL to post to
 * @param  {Object}   formData JSON form data to POST. Expects at least client_id
 * @param  {Function} callback function to invoke when done. First arg is error, second is OAuth object
 */
function post(url, formData, callback) {
	var xhr = Ti.Network.createHTTPClient({
		// function called when the response data is available
		onload : function(e) {
			var resp = JSON.parse(this.responseText),
				oauth = new OAuth(formData.client_id);

			oauth.expiresIn = parseFloat(resp.expires_in, 10) * 1000 + (new Date()).getTime();
			oauth.tokenType = resp.token_type;
			oauth.accessToken = resp.access_token;
			oauth.refreshToken = resp.refresh_token;
			oauth.clientSecret = formData.client_secret;
			oauth.save();

			callback(null, oauth);
		},
		// function called when an error occurs, including a timeout
		onerror : function(e) {
			callback(this.statusText || e.error);
		},
		timeout : 5000 /* in milliseconds */
	});

	// Prepare the connection.
	xhr.open('POST', url);

	// TODO support using basic auth to embed client id and client secret?
	xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

	// Send the request.
	xhr.send(formData);
}

/**
 * Generate a GUID to use for state parameter used to prevent CSRF.
 * @return {String} generated GUID
 */
function generateGUID() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
		return v.toString(16);
	});
}

/**
 * Returns an Object with the query param key/value pairs.
 * @param  {String} url URL containing query params
 * @return {Object}	 key/value pairs from query params on an URL
 */
function parseQueryParams(url) {
	var queryParams = {},
		pairs = [],
		keyValuePair;

	// FIXME handle when there are no query params?
	pairs = decodeURI(url).slice(CALLBACK_URL.length + 1).split('&'); // cut off base callback URL and ? char

	for (var i = 0; i < pairs.length; i++) {
		keyValuePair = pairs[i].split('=');
		queryParams[keyValuePair[0]] = keyValuePair[1];
	}

	return queryParams;
}

/********** OAuth **********/

var OAuth = function OAuth(clientId) {
	this.clientId = clientId;
	this.accessToken = null;
	this.refreshToken = null;
	this.tokenType = null;
	this.expiresIn = 0;
	this.ignoreSslError = false;
};

/**
 * Attempts to load existing tokens from disk for a given clientId.
 */
OAuth.prototype.load = function() {
	this.accessToken = Ti.App.Properties.getString(this.clientId + '.accessToken');
	this.refreshToken = Ti.App.Properties.getString(this.clientId + '.refreshToken');
	this.tokenType = Ti.App.Properties.getString(this.clientId + '.tokenType');
	this.expiresIn = Ti.App.Properties.getString(this.clientId + '.expiresIn');
};

/**
 * Persists tokens to disk for a given clientId.
 */
OAuth.prototype.save = function() {
	Ti.App.Properties.setString(this.clientId + '.accessToken', this.accessToken || '');
	Ti.App.Properties.setString(this.clientId + '.refreshToken', this.refreshToken || '');
	Ti.App.Properties.setString(this.clientId + '.tokenType', this.tokenType || '');
	Ti.App.Properties.setString(this.clientId + '.expiresIn', 0);
};

/**
 * Invalidates tokens for a given client id (wipes from this model and persists empty values back to disk)
 */
OAuth.prototype.invalidate = function() {
	this.accessToken = null;
	this.refreshToken = null;
	this.tokenType = null;
	this.expiresIn = 0;
	this.save();
};

/**
 * Refreshes the OAuth token.
 * @param  {String}   url      [description]
 * @param  {Function} callback [description]
 */
OAuth.prototype.refresh = function (url, callback) {
	var self = this;

	if (!this.refreshToken) {
		return callback('This OAuth flow type doesn\'t support refreshing.');
	}

	// TODO If we don't have a refreshToken, maybe just re-auth? I mean we have the clientId so can do implicit re-auth if we keep the URL around
	//
	post(url, {
		client_id: this.clientId,
		client_secret: this.clientSecret,
		refresh_token: this.refreshToken,
		grant_type: 'refresh_token'
	}, function (err, oauth) {
		if (err) {
			return callback(err);
		}

		// Update our fields and return us
		self.refreshToken = oauth.refreshToken;
		self.accessToken = oauth.accessToken;
		self.expiresIn = oauth.expiresIn;
		self.save();

		return callback(null, self);
	});
};

/**
 * Begins the OAuth 2.0 Implicit flow. This will open a Webview to authorize
 * with the user. If the flow fails or the user denies, we call the callback
 * function with an error. If it succeeds we return an OAuth object as the second
 * argument to the callback.
 *
 * @param  {String}   url         The token endpoint URL
 * @param  {String}   clientId    The client id
 * @param  {String}   [scopes=''] The scopes to authorize for. Optional argument.
 * @param  {Function} callback    First arg is error (if any), second is OAuth object on success.
 */
OAuth.authorizeImplicitly = function(url, clientId, scopes, callback) {
	if (typeof scopes === 'function') {
		callback = scopes;
		scopes = '';
	}
	var win,
		nav,
		webview,
		state = generateGUID();

	win = Ti.UI.createWindow(AUTH_WINDOW_OPTIONS);

	if (isiOS === true) {
		var closeButton = Ti.UI.createButton({
			title: L('close', 'Close')
		});

		nav = Ti.UI.iOS.createNavigationWindow({
			window: win
		});

		closeButton.addEventListener('click', function() {
			nav.close();
		});

		win.setRightNavButton(closeButton);
	}

	webview = Ti.UI.createWebView({
		width : Ti.UI.FILL,
		height : Ti.UI.FILL,
		ignoreSslError: this.ignoreSslError,
		url : buildURL(url, {
			scope: scopes,
			approval_prompt: 'force',
			redirect_uri: CALLBACK_URL,
			response_type: 'token',
			client_id: clientId,
			btmpl: 'mobile',
			state: state
		})
	});

	win.add(webview);

	webview.addEventListener('error', function(e) {
		var queryParams = parseQueryParams(e.url);

		if (queryParams.error) {
			if (isiOS === true) {
				nav.close();
			} else {
				win.close();
			}

			return callback(queryParams.error_description || queryParams.error);
		}

		if (queryParams.access_token) {
			if (isiOS === true) {
				nav.close();
			} else {
				win.close();
			}

			// check CSRF
			if (queryParams.state !== state) {
				return callback('Possible Cross-site request forgery. state doesn\'t match.');
			}

			var oauth = new OAuth(clientId);
			oauth.accessToken = queryParams.access_token;

			if (queryParams.expires_in) {
				oauth.expiresIn = parseFloat(queryParams.expires_in, 10) * 1000 + (new Date()).getTime();
			}

			oauth.tokenType = queryParams.token_type;
			return callback(null, oauth);
		}

		win.close();
		return callback(e.error);
	});

	if (isiOS === true) {
		nav.open({
			modal: true
		});
	} else {
		win.open();
	}
};

/**
 * Authorizes with username/password for OAuth 2.0
 *
 * @param  {String}   url The oauth endpoint URL
 * @param  {String}   clientId The client id
 * @param  {String}   clientSecret The client secret
 * @param  {String}   username The username to log in.
 * @param  {String}   password The password to log in.
 * @param  {String}   [scopes=''] The scopes to authorize for. Optional argument.
 * @param  {Function} callback Callback function, called when auth is done.
 * First arg is error object if any, second is an OAuth object
 */
// TODO Support putting clientId/secret into basic auth header rather than body?
// TODO According to the RFC spec, we shouldn't send client secret
OAuth.authorizeWithPassword = function (url, clientId, clientSecret, username, password, scopes, callback) {
	if (typeof scopes === 'function') {
		callback = scopes;
		scopes = '';
	}
	post(url, {
		grant_type: 'password',
		username: username,
		password: password,
		client_id: clientId,
		client_secret: clientSecret,
		scope: scopes
	}, callback);
};

/**
 * Begins the OAuth 2.0 Explicit flow, a 2-legged auth flow. This will open a
 * Webview to authorize with the user and receive a code. The second part will
 * pass the code to the token endpoint for an ccess token. If the flow fails or
 * the user denies permission, we call the callback function with an error as
 * first arg. If it succeeds we return an OAuth object as the second argument to
 * the callback.
 *
 * @param  {String}   authURL  The URL for the first stage, get an auth code here.
 * @param  {String}   tokenURL The URL to use for second stage, get the access token by passing auth code here.
 * @param  {String}   clientId
 * @param  {String}   clientSecret
 * @param  {String}   [scopes=''] The scopes to authorize for. Optional argument.
 * @param  {Function} callback Callback function. First arg is error (if any), second is accessToken/code.
 */
// TODO According to the RFC spec, we shouldn't send client secret for native apps.
OAuth.authorizeExplicitly = function(authURL, tokenURL, clientId, clientSecret, scopes, callback) {
	if (typeof scopes === 'function') {
		callback = scopes;
		scopes = '';
	}
	var win,
		webview,
		spinner,
		nav,
		retryCount = 0,
		state = generateGUID(),
		next = function(err, code) {
			if (err) {
				win.close();
				return callback(err);
			}

			webview.hide();
			spinner.show();

			post(tokenURL, {
				grant_type: 'authorization_code',
				code: code,
				redirect_uri: CALLBACK_URL,
				client_id: clientId,
				client_secret: clientSecret
			}, callback);
		};

	win = Ti.UI.createWindow(AUTH_WINDOW_OPTIONS);

	if (isiOS === true) {
		var closeButton = Ti.UI.createButton({
			title: L('close', 'Close')
		});

		nav = Ti.UI.iOS.createNavigationWindow({
			window: win
		});

		closeButton.addEventListener('click', function() {
			nav.close();
		});

		win.setRightNavButton(closeButton);
	}

	spinner = Ti.UI.createActivityIndicator({
		zIndex : 1,
		height : 50,
		width : 50,
		hide : true,
		style : Ti.UI.ActivityIndicatorStyle.DARK
	});

	webview = Ti.UI.createWebView({
		width : Ti.UI.FILL,
		height : Ti.UI.FILL,
		ignoreSslError: this.ignoreSslError,
		url : buildURL(authURL, {
			response_type: 'code',
			client_id: clientId,
			redirect_uri: CALLBACK_URL,
			scope: scopes,
			approval_prompt: 'force',
			btmpl: 'mobile',
			state: state
		})
	});

	win.add(spinner);
	win.add(webview);

	webview.addEventListener('error', function(e) {
		var queryParams = parseQueryParams(e.url);

		if (queryParams.error) {
			return next(queryParams.error_description || queryParams.error);
		}

		if (queryParams.code) {
			// check CSRF
			if (queryParams.state !== state) {
				return callback('Possible Cross-site request forgery. state doesn\'t match.');
			}
			return next(null, queryParams.code);
		}
		return next(e.error);
	});

	if (isiOS === true) {
		nav.open({
			modal: true
		});
	} else {
		win.open();
	}
};


/**
 * Authorizes with client_id/client_secret for OAuth 2.0
 *
 * @param  {String}   url The oauth endpoint URL
 * @param  {String}   clientId The client id
 * @param  {String}   clientSecret The client secret
 * @param  {String}   [scopes=''] The scopes to authorize for. Optional argument.
 * @param  {Function} callback Callback function, called when auth is done.
 * First arg is error object if any, second is an OAuth object
 */
// TODO Support putting clientId/secret into basic auth header rather than body?
// TODO According to the RFC spec, we shouldn't send client secret
OAuth.authorizeWithApplication = function (url, clientId, clientSecret, scopes, callback) {
	if (typeof scopes === 'function') {
		callback = scopes;
		scopes = '';
	}
	post(url, {
		grant_type: 'client_credentials',
		client_id: clientId,
		client_secret: clientSecret,
		scope: scopes
	}, callback);
};

export default OAuth;
