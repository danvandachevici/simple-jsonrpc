# simple-jsonrpc
A quick and easy-to-use library for JSON-RPC serving.

	npm install simple-jsonrpc-server

In order to create a server that serves **JSON-RPC** requests, simply create the server as usual, initialize the jsonrpc lib with the right init object, and pass the jsonrpc handler to all requests handlers.
	
	//index.js
	var jsonrpc = require ('simple-jsonrpc-server');
	
	var http = require('http');
	var fs = require('fs');
	
	var jsonrpc_init_obj = {
		env: {
			master_key: 'value'
		},
		routes: [
			{
				route: '/api/test',
				handler: require('./test_handler.js'),
				env: {
					increment: 4,
					inside_key: 'value2'
				}
			}
		]
	}
	
	jsonrpc.init(jsonrpc_init_obj, function (err) {
		http.createServer(jsonrpc.request_handler).listen(9615);
	});


	//./test_handler.js:
	module.exports = {
	    test_func: function (env, req, params, cb) {
	    },
	    test_func2: function (env, req, params, cb) {
	    },
	    add: function (env, req, params, cb) {
	        if (typeof (params.a) === "undefined") {
	            return cb(null, env.increment);
	        }
	        if (typeof (params.b) === "undefined") {
	            cb(null, params.a + env.increment);
	        } else {
	            cb(null, params.a + params.b);
	        }
	    }
	}

And now, simply run this script in a terminal

	node index.js

... and in another terminal, test your api:

	$ curl -X POST -H "Content-type: application/json" -d '{"jsonrpc":"2.0", "id":32, "method": "add", "params":{"a":3}}' http://localhost:9615/api/test
	{"jsonrpc":"2.0","id":32,"result":7}
