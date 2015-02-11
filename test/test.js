var assert = require("assert");
var should = require("should");
var jsonrpc = require ('../index.js');
var http = require('http');
describe ("JSON RPC server:", function () {
	describe ("Configuration:", function () {
		it('Should be able to init', function (){
			var jsonrpc_init_obj = {
				routes: [
					{
						route: '/api/test',
						handler: require('./test_handler.js'),
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
});
