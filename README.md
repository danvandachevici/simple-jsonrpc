# simple-jsonrpc
A quick and easy-to-use library for JSON-RPC server.

	npm install simple-jsonrpc-server

In order to create a server that serves **JSON-RPC** requests, simply create the server as usual, initialize the jsonrpc lib with the right init object, and pass the jsonrpc handler to all requests handlers.

*index.js*
	
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
				handler: require('./handler.js'),
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

*handler.js*

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

In the previous example, we called the 'add' method, with only one parameter, _a_. The method knows that if it is only called with 'a', it should simply return the incremented value, with the default increment. This increment is taken from the environment variable, that was set up at the configuration of the routes.

	$ curl -X POST -H "Content-type: application/json" -d '{"jsonrpc":"2.0", "id":32, "method": "add", "params":{"a":3, "b": 5}}' http://localhost:9615/api/test
	{"jsonrpc":"2.0","id":32,"result":8}

In this example, the second parameter is explicit, so this means I don't just want to increment 'a' with the default value, I specifically want to add 3 + 5, so the environment variable is ignored.

## Environment precedence
The generic environment is overwritten by each route's environment.

Batch requests
==============

Not implemented yet

Get requests
============

Not implemented yet
