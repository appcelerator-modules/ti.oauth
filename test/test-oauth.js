/* global Ti */
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
// TODO Add tests cases for calling onerror of httpclient for timeouts/etc
describe('OAuth 2.0', () => {
	describe('Authorization Code Grant', () => {
	});
	describe('Implicit Grant', () => {
		it('should authorize', (done) => {
			Ti.UI.Webview.handler = (webview) => {
				// Validate the url set on the webview, etc
				expect(webview.url).to.include(`http://brentertainment.com/oauth2/lockdin/authorize?scope=&approval_prompt=force&redirect_uri=http%3A%2F%2Flocalhost%2FCallback&response_type=token&client_id=${implicit.clientId}&btmpl=mobile&state=`);
				let state = webview.url.slice(webview.url.indexOf('state=') + 6);
				// fire error event
				let error = webview.eventListeners['error'] || [];
				error.forEach( callback => {
					callback({ url: `http://localhost/Callback?access_token=997f871ee3194eb39b4f2a19d5871cb8608e9c0a&state=${state}&token_type=Bearer` });
				});
			};
			OAuth.authorizeImplicitly(implicit.url, implicit.clientId, function (err, oauth) {
				if (err) {
					return done(err);
				}

				expect(oauth).to.exist;
				expect(oauth).to.be.an('object');
				expect(oauth.clientId).to.equal(password.clientId);
				expect(oauth.accessToken).to.equal('997f871ee3194eb39b4f2a19d5871cb8608e9c0a');
				expect(oauth.tokenType).to.equal('Bearer');

				done();
			});
		});

		it('should return error for possible CSRF from un-matched state value', (done) => {
			Ti.UI.Webview.handler = (webview) => {
				// Validate the url set on the webview, etc
				expect(webview.url).to.include(`http://brentertainment.com/oauth2/lockdin/authorize?scope=&approval_prompt=force&redirect_uri=http%3A%2F%2Flocalhost%2FCallback&response_type=token&client_id=${implicit.clientId}&btmpl=mobile&state=`);
				// fire error event
				let error = webview.eventListeners['error'] || [];
				error.forEach(callback => {
					callback({ url: 'http://localhost/Callback?access_token=997f871ee3194eb39b4f2a19d5871cb8608e9c0a&state=madeupstate&token_type=Bearer' });
				});
			};
			OAuth.authorizeImplicitly(implicit.url, implicit.clientId, function (err, oauth) {
				expect(err).to.exist;

				expect(oauth).not.to.exist;

				done();
			});
		});

		it('should not allow refresh of token', (done) => {
			Ti.UI.Webview.handler = (webview) => {
				// Validate the url set on the webview, etc
				expect(webview.url).to.include(`http://brentertainment.com/oauth2/lockdin/authorize?scope=&approval_prompt=force&redirect_uri=http%3A%2F%2Flocalhost%2FCallback&response_type=token&client_id=${implicit.clientId}&btmpl=mobile&state=`);
				let state = webview.url.slice(webview.url.indexOf('state=') + 6);
				// fire error event
				let error = webview.eventListeners['error'] || [];
				error.forEach( callback => {
					callback({ url: `http://localhost/Callback?access_token=997f871ee3194eb39b4f2a19d5871cb8608e9c0a&state=${state}&token_type=Bearer` });
				});
			};
			OAuth.authorizeImplicitly(implicit.url, implicit.clientId, function (err, oauth) {
				if (err) {
					return done(err);
				}

				expect(oauth).to.exist;

				oauth.refresh('http://example.com/refreshUrl', function (err, refresh_oauth) {
					expect(err).to.exist;
					expect(refresh_oauth).not.to.exist;
					done();
				});
			});
		});
	});
	describe('Resource Owner Password Credentials Grant', () => {
		it('should authorize with username and password', (done) => {
			Ti.Network.HTTPClient.handler = (httpclient) => {
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

		it('should allow refresh of token', (done) => {
			Ti.Network.HTTPClient.handler = (httpclient) => {
				httpclient.responseText = '{"access_token":"997f871ee3194eb39b4f2a19d5871cb8608e9c0a","expires_in":3600,"token_type":"Bearer","scope":null,"refresh_token":"2a6c5b92369fb8c8f56a82e7a1b81dbf6d756a69"}';
				httpclient.status = 200;

				httpclient.onload();
			};
			OAuth.authorizeWithPassword(password.url, password.clientId, password.clientSecret, password.username, password.password, function (err, oauth) {
				if (err) {
					return done(err);
				}

				expect(oauth).to.exist;
				expect(oauth.refreshToken).to.equal('2a6c5b92369fb8c8f56a82e7a1b81dbf6d756a69');

				// Set up next response
				Ti.Network.HTTPClient.handler = (httpclient) => {
					httpclient.responseText = '{"access_token":"2a6c5b92369fb8c8f56a82e7a1b81dbf6d756a60","expires_in":3600,"token_type":"Bearer","scope":null,"refresh_token":"997f871ee3194eb39b4f2a19d5871cb8608e9c0b"}';
					httpclient.status = 200;

					httpclient.onload();
				};

				oauth.refresh('http://example.com/refreshUrl', function (err, refresh_oauth) {
					expect(err).not.to.exist;
					expect(refresh_oauth).to.exist;
					expect(oauth.accessToken).to.equal('2a6c5b92369fb8c8f56a82e7a1b81dbf6d756a60');
					expect(oauth.refreshToken).to.equal('997f871ee3194eb39b4f2a19d5871cb8608e9c0b');

					done();
				});
			});
		});
	});
	describe('Client Credentials Grant', () => {
	});
});
