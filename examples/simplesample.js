var jsonrpc = require ('../index.js');

var http = require('http');

var jsonrpc_init_obj = {
	loglevel: 'info',
	env: {
		master_key: 'value'
	},
	routes: [
		{
			route: '/api/test',
            validator: require('./lib/schema'),
			handler: require('./test_handler.js'),
            middleware: [],
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

jsonrpc.init(jsonrpc_init_obj, function (err, request_handler) {
    console.log("Started listening on 9615");
	http.createServer(request_handler).listen(9615);
});