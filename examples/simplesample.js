var jsonrpc = require ('../index.js');
console.log (jsonrpc);

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
})
