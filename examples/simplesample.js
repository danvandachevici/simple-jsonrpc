var jsonrpc = require ('../index.js');

var http = require('http');
var fs = require('fs');

var jsonrpc_init_obj = {
	loglevel: 'info',
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
		},
		{
			route: '/api/user',
			handler: require('./login_handler.js')
		}
	]
}

jsonrpc.init(jsonrpc_init_obj, function (err) {
	http.createServer(jsonrpc.request_handler).listen(9615);
})
