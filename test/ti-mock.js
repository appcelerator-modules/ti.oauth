
/* Generate a mock Ti.Network.HTTPClient for testing */
function TiNetworkHTTPClient(obj) {
	this.timeout = obj.timeout;
	this.onload = obj.onload;
	this.onerror = obj.onerror;
	this.headers = {};
}

TiNetworkHTTPClient.handler = function (httpclient) {
	httpclient.responseText = '';
	httpclient.status = 200;
	httpclient.statusText = 'OK';
	httpclient.onload();
};

TiNetworkHTTPClient.prototype.send = function(data) {
	this.data = data;
	TiNetworkHTTPClient.handler(this);
};

TiNetworkHTTPClient.prototype.setRequestHeader = function(name, value) {
	this.headers[name] = value;
};

TiNetworkHTTPClient.prototype.open = function(method, url) {
	this.method = method;
	this.url = url;
};

function TiUIWindow(obj) {
	this.children = [];
}

TiUIWindow.prototype.add = function (view) {
	this.children.push(view);
};

TiUIWindow.prototype.open = function () {
	this.children.forEach(c => c.show()); // FIXME Should we call show on each child? or some method noting it's been opened?
};

TiUIWindow.prototype.close = function () {
	// no-op
};

function TiUIWebview(obj) {
	this.url = obj.url;
	this.width = obj.width;
	this.height = obj.height;
	this.eventListeners = {};
}

TiUIWebview.handler = function (webview) {
	// fire beforeload
	let beforeLoad = webview.eventListeners['beforeload'] || [];
	beforeLoad.forEach(callback => callback({ url: webview.url }));
	// fire load
	let load = webview.eventListeners['load'] || [];
	load.forEach(callback => callback({ url: webview.url }));
};

TiUIWebview.prototype.addEventListener = function (name, callback) {
	let listeners = this.eventListeners[name] || [];
	listeners.push(callback);
	this.eventListeners[name] = listeners;
};

TiUIWebview.prototype.show = function () {
	// Load the URL
	TiUIWebview.handler(this);
};

TiUIWebview.prototype.hide = function () {
	// no-op
};

function TiUIActivityIndicator(obj) {

}

TiUIActivityIndicator.prototype.show = function () {
	// no-op
};

TiUIActivityIndicator.prototype.hide = function () {
	// no-op
};


let Ti = {
	Network: {
		createHTTPClient: function(obj) {
			return new TiNetworkHTTPClient(obj);
		},
		HTTPClient: TiNetworkHTTPClient
	},
	App: {
		Properties: {
			_props: {},
			setString: function (key, value) {
				global.Ti.App.Properties._props[key] = value;
			},
			getString: function (key, def) {
				if (global.Ti.App.Properties._props.hasOwnProperty(key)) {
					return global.Ti.App.Properties._props[key];
				}
				return def;
			}
		}
	},
	Platform: {
		osname: 'android'
	},
	UI: {
		ActivityIndicator: TiUIActivityIndicator,
		Window: TiUIWindow,
		Webview: TiUIWebview,
		ActivityIndicatorStyle: {
			DARK: 1
		},
		createActivityIndicator: function (obj) {
			return new TiUIActivityIndicator(obj);
		},
		createWindow: function(obj) {
			return new TiUIWindow(obj);
		},
		createWebView: function(obj) {
			return new TiUIWebview(obj);
		}
	}
};

export default Ti;
