var assert = require("assert");
var should = require("should");
var jsonrpc = require ('../index.js');
var http = require('http');
var request = require('request');

var testport = 9983;

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
			assert.equal(0, jsonrpc.lib_can_init(jsonrpc_init_obj).code);
		});
		it ("Should find no routes - empty init obj", function () {
			var jsonrpc_init_obj = {
			};
			assert.equal(-32002, jsonrpc.lib_can_init(jsonrpc_init_obj).code);
		});
		it ("Should find no routes - empty routes array", function () {
			var jsonrpc_init_obj = {
				routes: []
			};
			assert.equal(-32002, jsonrpc.lib_can_init(jsonrpc_init_obj).code);
		});
		it ("Should check for init obj - null init obj", function () {
			var jsonrpc_init_obj = null;
			assert.equal(-32001, jsonrpc.lib_can_init(jsonrpc_init_obj).code);
		});
		it ("Should check routes - no 'route' property", function () {
			var jsonrpc_init_obj = {
				routes: [{}]
			};
			assert.equal(-32003, jsonrpc.lib_can_init(jsonrpc_init_obj).code);
		});
		it ("Should check routes - not-object", function () {
			var jsonrpc_init_obj = {
				routes: ['/api/call/']
			};
			assert.equal(-32003, jsonrpc.lib_can_init(jsonrpc_init_obj).code);
		});
	});

	describe ("Initialization:", function () {
	});
	describe ("Routes:", function () {
		var gresp, gbody;
		var request_with_params = function (prms, done) {
			var opts = {
				uri: 'http://localhost:' + testport + "/api/test",
				method: "POST",
				json: {
					method: "add",
					jsonrpc: "2.0",
					id: 3,
					params: prms
				}
			};
			request(opts, function (err, resp, body) {
				gresp = resp;
				gbody = body;
				done();
			});
		}
		before(function(done) {
			var jsonrpc_init_obj = {
				routes: [
					{
						route: '/api/test',
						handler: require('./handler.js'),
						env: {increment: 1}
					}
				]
			};
			jsonrpc.init(jsonrpc_init_obj, function (err) {
				http.createServer(jsonrpc.request_handler).listen(testport);
				request_with_params({a: 3}, done);
			});
		});
		it ("Should increment 3 to 4", function () {
			var result = {jsonrpc: "2.0", id:3, result: 4};
			assert.equal (200, gresp.statusCode)
			assert.deepEqual(result, gbody);
		});
	});
});
