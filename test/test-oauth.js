
// TODO Need some way to mock out the webview portion, basically just verify the URL we passed and be able to fake a response URL

let handler = function (httpclient) {
	httpclient.responseText = '';
	httpclient.onload();
};

/* Generate a mock Ti.Network.HTTPClient for testing */
function HTTPClient(obj) {
	this.timeout = obj.timeout;
	this.onload = obj.onload;
	this.onerror = obj.onerror;
	this.headers = {};
}

HTTPClient.prototype.send = function(data) {
	this.data = data;
	handler(this);
};

HTTPClient.prototype.setRequestHeader = function(name, value) {
	this.headers[name] = value;
};

HTTPClient.prototype.open = function(method, url) {
	this.method = method;
	this.url = url;
};

global.Ti = {
	Network: {
		createHTTPClient: function(obj) {
			return new HTTPClient(obj);
		}
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
	}
};

import OAuth from '../src/index';

const implicit = {
		url: 'http://brentertainment.com/oauth2/lockdin/authorize',
		clientId: 'demoapp'
	},
	explicit = {
		url: 'http://brentertainment.com/oauth2/lockdin/authorize',
		clientId: 'demoapp',
		clientSecret: 'demopass',
		tokenUrl: 'http://brentertainment.com/oauth2/client/request_token/authorization_code'
	},
	password = {
		url: 'http://brentertainment.com/oauth2/lockdin/token',
		clientId: 'demoapp',
		clientSecret: 'demopass',
		username: 'demouser',
		password: 'testpass'
	};

describe('OAuth 2.0', () => {
	describe('Authorization Code Grant', () => {
	});
	describe('Implicit Grant', () => {
	});
	describe('Resource Owner Password Credentials Grant', () => {
		// TODO Add tests to handle failure cases!
		it('should authorize with username and password', (done) => {
			handler = function (httpclient) {
				// Verify headers/data/method/url
				expect(httpclient.headers).to.have.property('Content-Type', 'application/x-www-form-urlencoded');
				expect(httpclient.method).to.equal('POST');
				expect(httpclient.url).to.equal(password.url);
				expect(httpclient.data).to.have.property('grant_type', 'password');
				expect(httpclient.data).to.have.property('username', password.username);
				expect(httpclient.data).to.have.property('password', password.password);
				expect(httpclient.data).to.have.property('client_id', password.clientId);
				expect(httpclient.data).to.have.property('client_secret', password.clientSecret);

				httpclient.responseText = '{"access_token":"997f871ee3194eb39b4f2a19d5871cb8608e9c0a","expires_in":3600,"token_type":"Bearer","scope":null,"refresh_token":"2a6c5b92369fb8c8f56a82e7a1b81dbf6d756a69"}';
				httpclient.status = 200;

				httpclient.onload();
			};
			OAuth.authorizeWithPassword(password.url, password.clientId, password.clientSecret, password.username, password.password, function (err, oauth) {
				if (err) {
					return done(err);
				}

				expect(oauth).to.exist;
				expect(oauth).to.be.an('object');
				expect(oauth.clientId).to.equal(password.clientId);
				expect(oauth.accessToken).to.equal('997f871ee3194eb39b4f2a19d5871cb8608e9c0a');
				expect(oauth.refreshToken).to.equal('2a6c5b92369fb8c8f56a82e7a1b81dbf6d756a69');
				expect(oauth.tokenType).to.equal('Bearer');
				//expect(oauth.expiresIn).to.equal(3600); // FIXME This becomes current time + 3600

				done();
			});
		});
	});
	describe('Client Credentials Grant', () => {
	});
});
