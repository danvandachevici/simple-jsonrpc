var assert 		= require("assert");
var jsonrpc 	= require ('../index.js');
var http 		= require('http');
var request 	= require('request');
var log 		= require ('simple-color-log');

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
			assert.equal(0, jsonrpc.lib_can_init(jsonrpc_init_obj).code);
		});
		it ("Should find no init obj - empty init obj", function () {
			var jsonrpc_init_obj = {};
			assert.equal(-32001, jsonrpc.lib_can_init(jsonrpc_init_obj).code);
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
			jsonrpc.init(jsonrpc_init_obj, function (err) {
				server = http.createServer(jsonrpc.requestHandler).listen(testport);
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
			var result = {jsonrpc: "2.0", id:3, result: 4};
			request_with_params({}, function(err, res, body) {
				assert.deepEqual (err, null);
				assert.equal(200, res.statusCode);
				assert.equal(1, body.result)
				done();
			});
		});
		it ("Should fail gracefuly if request too big", function (done) {
			var result = {jsonrpc: "2.0", id:3, result: 4};
			var str = {key: "dowpkaofkoekefokgorejgiejiiiiiiiiiiiiiiiiiiiiiiiiiiiiiijoinknjnjknkiojuyuhbjnkjiuyghjnkmijuhjkmiojujkijujkijkmliojuhjnkmiojujnkmjiujnkmiojujnkmliojuhbjnkmloiuhjnkmloiujnkmliojuhjnkm"};
			request_with_params(str, function(err, res, body) {
				assert.deepEqual (body, {jsonrpc: "2.0", id: 4, error: {code: -32600, message: "Invalid request"}});
				assert.equal(413, res.statusCode);
				done();
			});
		});
	});
});
