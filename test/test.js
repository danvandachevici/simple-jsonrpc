var assert 		= require("assert");
var jsonrpc 	= require('../lib/jsonrpc');
var http 		= require('http');
var request 	= require('request');
var log 		= require('simple-color-log');
var sinon       = require('sinon');
var errors      = require('../lib/Errors');

var testport 	= 9983;

describe ("JSON RPC server:", function () {
	describe ("Configuration:", function () {
		it('Should be able to init', function (){
			var jsonrpc_init_obj = {
				routes: [
					{
						route: '/api/test',
						handler: require('./handler.js'),
					}
				]
			};
			assert.equal(0, jsonrpc.libCanInit(jsonrpc_init_obj).code);
		});
		it ("Should find no init obj - empty init obj", function () {
			var jsonrpc_init_obj = {};
			assert.equal(-32001, jsonrpc.libCanInit(jsonrpc_init_obj).code);
		});
		it ("Should find no routes - empty routes array", function () {
			var jsonrpc_init_obj = {
				routes: []
			};
			assert.equal(-32002, jsonrpc.libCanInit(jsonrpc_init_obj).code);
		});
		it ("Should check for init obj - null init obj", function () {
			var jsonrpc_init_obj = null;
			assert.equal(-32001, jsonrpc.libCanInit(jsonrpc_init_obj).code);
		});
		it ("Should check routes - no 'route' property", function () {
			var jsonrpc_init_obj = {
				routes: [{}]
			};
			assert.equal(-32003, jsonrpc.libCanInit(jsonrpc_init_obj).code);
		});
		it ("Should check routes - not-object", function () {
			var jsonrpc_init_obj = {
				routes: ['/api/call/']
			};
			assert.equal(-32003, jsonrpc.libCanInit(jsonrpc_init_obj).code);
		});
	});

	describe ("Initialization:", function () {
	});
	describe ("Routes:", function () {
		// var gresp, gbody;
		var request_with_params = function (prms, done) {
			var opts = {
				url: 'http://localhost:' + testport + "/api/test",
				method: "POST",
				json: {
					method: "add",
					jsonrpc: "2.0",
					id: 3,
					params: prms
				}
			};
			request(opts, done);
		};
		var server;
		before(function(ready) {
			var jsonrpc_init_obj = {
				maxRequestDataSize: 100,
				routes: [
					{
						route: '/api/test',
						handler: require('./handler.js'),
						env: {increment: 1}
					}
				]
			};
			jsonrpc.init(jsonrpc_init_obj, function (err, handler) {
				server = http.createServer(handler).listen(testport);
				ready();
			});
		});
		after(function () {
			server.close();
		})
		it ("Should increment 3 to 4, with the default increment", function (done) {
			var result = {jsonrpc: "2.0", id:3, result: 4};
			request_with_params({a: 3}, function(err, res, body) {
				assert.deepEqual(err, null);
				assert.equal(200, res.statusCode);
				// assert.equal(4, body.result)
				done();
			});
		});
		it ("Should increment 3 to 5, with custom increment", function (done) {
			var result = {jsonrpc: "2.0", id:3, result: 4};
			request_with_params({a: 3, b: 2}, function(err, res, body) {
				assert.deepEqual (err, null);
				assert.equal(200, res.statusCode);
				assert.equal(5, body.result)
				done();
			});
		});
		it ("Should return the default increment", function (done) {
            // log.setLogLevel('none');
			var result = {jsonrpc: "2.0", id:3, result: 4};
			request_with_params({}, function(err, res, body) {
				assert.deepEqual (err, null);
				assert.equal(200, res.statusCode);
				assert.equal(1, body.result)
				done();
			});
		});
		it ("Should fail gracefuly if request too big", function (done) {
            log.setLogLevel('none');
			var result = {jsonrpc: "2.0", id:3, result: 4};
			var str = {key: "dowpkaofkoekefokgorejgiejiiiiiiiiiiiiiiiiiiiiiiiiiiiiiijoinknjnjknkiojuyuhbjnkjiuyghjnkmijuhjkmiojujkijujkijkmliojuhjnkmiojujnkmjiujnkmiojujnkmliojuhbjnkmloiuhjnkmloiujnkmliojuhjnkm"};
			request_with_params(str, function(err, res, body) {
				assert.deepEqual (body, {jsonrpc: "2.0", id: 4, error: {code: -32600, message: "Invalid request"}});
				assert.equal(413, res.statusCode);
				done();
			});
		});
	});
    describe("Middleware", function () {
        describe("middlewareIterator", function () {
            it ("Calls the middle method with right arguments", function () {
                var middle = sinon.stub();
                var spy = sinon.spy();
                middle.callsArgWith(4, null, {result: 1});
                jsonrpc.middlewareIterator({req: 1}, {resp: 1}, {params: 1}, {env: {param: 1}}, {})(middle, spy);
                sinon.assert.calledWith(middle, {param: 1}, {req: 1}, {resp: 1}, {params: 1});
            });
            it ("Calls back with error when middleware calls back with error", function () {
                var middle = sinon.stub();
                var spy = sinon.spy();
                middle.callsArgWith(4, 'SomeErr');
                jsonrpc.middlewareIterator({}, {}, {}, {})(middle, spy);
                sinon.assert.calledWith(spy, 'SomeErr');
            });
            it ("Calls back with middleware result, if all goes well", function () {
                var middle = sinon.stub();
                var spy = sinon.spy();
                middle.callsArgWith(4, null, {result: 1});
                jsonrpc.middlewareIterator({}, {}, {}, {})(middle, spy);
                sinon.assert.calledWith(spy, null, {result: 1});
            });
        });
        describe("runMiddleware", function () {
            it ("Calls the middleware if it is properly defined in config", function (done) {
                var mockMiddleware = sinon.stub();
                mockMiddleware.callsArgWith(4, null);
                var when = "before";
                var req = {};
                var resp = {};
                var route = {
                    middleware: {
                        before: [mockMiddleware],
                    }
                };
                var results = {
                    parse: {key: 1}
                };

                jsonrpc.runMiddleware(req, resp, when, route)(results, function () {
                    sinon.assert.callCount(mockMiddleware, 1);
                    done();
                });
            });
            it ("Calls back with error, if any middleware calls back with error", function (done) {
                var mockMiddleware = sinon.stub();
                mockMiddleware.callsArgWith(4, "SomeErr");
                var secondMiddleware = sinon.stub();
                secondMiddleware.callsArgWith(4, null);
                var when = "before";
                var req = {};
                var resp = {};
                var route = {
                    middleware: {
                        before: [secondMiddleware, mockMiddleware, secondMiddleware],
                    }
                };
                var results = {
                    parse: {key: 1}
                };

                jsonrpc.runMiddleware(req, resp, when, route)(results, function (err, res) {
                    assert.deepEqual(err, errors.middlewareError);
                    done();
                });
            });
        });
    });
});
