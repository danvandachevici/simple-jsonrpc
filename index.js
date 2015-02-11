var async = require('async');
var url = require("url");
var jsonrpc = {};

var serverLogLevel = 1;
var loglevels = {
	'err': 1,
	'warn': 2,
	'info': 3,
	'debug': 4
};

var logger = function (message, level) {
	if (serverLogLevel <= loglevels[level]) {
		var d = new Date();
		var dstr = ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear() + " ";
		dstr += ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2) + '.' + ('00' + d.getMilliseconds()).slice(-3);
		console.log (dstr + '\t' + level.toUpperCase() + "\t" + message);
	}
};

var errs = {
	ok: {code: 0},
	noinit: {code: -32001, message: "Server error: No init object"},
	noroutes: {code: -32002, message: "Server error: No routes in init object"},
	wrongroute: {code: -32003, message: "Server error: Wrong route config in one of the routes"},
	methodnotfound: {code: -32601, message: "Method not found"},
	parseerror: {code: -32700, message: "Parse error"},
	handlererror: {code: -32004, message: "Handler error"}
}

var services = {};

var lib_can_init = jsonrpc.lib_can_init = function (initobj) {
	if (typeof initobj !== 'object' || initobj === null){
		return errs.noinit;
	}
	if ( ! (initobj.routes instanceof Object ) ) {
		return errs.noroutes;
	}
	if (Object.keys(initobj.routes).length === 0) {
		return errs.noroutes;
	}
	for (var i = 0; i < initobj.routes.length; i++) {
		if (typeof (initobj.routes[i]) !== "object" || initobj.routes[i] === null){
			return errs.wrongroute;
		}
		if ( ! initobj.routes[i].hasOwnProperty('route') || ! initobj.routes[i].hasOwnProperty('handler')) {
			return errs.wrongroute;
		}
	}
	return errs.ok;
}
var master_env = {};
jsonrpc.init = function (initobj, cb) {
	if (typeof (initobj.loglevel) === "number") {
		serverLogLevel = initobj.loglevel;
	}
	if (typeof (initobj.loglevel) === "string") {
		serverLogLevel = loglevels[initobj.loglevel];
	}
	logger('Initializing routes...', 'debug');
	if (typeof initobj.env === "object" && initobj.env !== null && Object.keys(initobj.env).length !== 0) {
		master_env = initobj.env;
	}
	var err = lib_can_init(initobj);
	if ( err.code !== 0 ) {
		logger ("Library can't init." + err.message, 'err');
		return cb(err);
	}
	var iterator = function (item, callback) {
		var srv = item.route;
		services[srv] = {
			handler: item.handler
		};
		services[srv].env = master_env;
		if (typeof (item.env) === "object" && item.env !== null && Object.keys(item.env).length !== 0) {
			for (var key in item.env) {
				services[srv].env[key] = item.env[key];
			}
		}
		logger('Registered route ' + srv, 'info');
		callback(null);
	};
	async.each (initobj.routes, iterator, function(err) {
		if (err) {
			logger ("Library can't init." + err, 'err');
			return cb(err);
		} else {
			logger ('Done initializing routes', 'debug');
			cb(null, null);
		}
	});
};
var is_jsonrpc_protocol = function (js) {
	if (js.jsonrpc !== "2.0" || typeof (js.method) !== "string" || js.method.match('^rpc\.') ) {
		return false;
	}
	return true;
}
var make_jsonrpc_response = function (id, err, data) {
	if (id === null) {
		// randomize the id:
		id = 4;	// :)
	}
	var resp = {
		jsonrpc: "2.0",
		id: id
	};
	if (err !== null) {
		resp.error = err;
		resp.error.data = data;
	} else {
		resp.result = data;
	}
	return JSON.stringify(resp);
}
jsonrpc.request_handler = function (req, resp) {
	resp.writeHead(200, {'Content-Type': 'application/json'})
	var uri = url.parse(req.url).pathname;
	logger("Received request to " + uri, 'debug');
	var method = req.method;
	var current_handler = null;
	var current_env = null;
	if (typeof (services[uri]) === "object" && services[uri] !== null) {
		current_handler = services[uri].handler;
		current_env = services[uri].env;
	} else {
		resp.end(make_jsonrpc_response(json.id, errs.methodnotfound));
		return;
	}
	if (current_handler === null) {
		resp.end(make_jsonrpc_response(json.id, errs.methodnotfound));
		return;
	}
	var body = '';
	var json = null;
	req.on('data', function (data) {
		body += data;
            // Too much POST data, kill the connection!
		if (body.length > 1e6) {
			req.connection.destroy();
		}
	});
	req.on('end', function () {
		try {
			json = JSON.parse(body);
		} catch (e) {
			logger ("Could not parse json:" +JSON.stringify(body) + " because:" + JSON.stringify(e), 'err');
			resp.end (make_jsonrpc_response(json.id, errs.parseerror));
			return;
		}
		if ( ! is_jsonrpc_protocol(json) ) {
			logger ("Not jsonrpc protocol," + JSON.stringify(json), 'err');
			resp.end(make_jsonrpc_response(json.id, errs.parseerror));
			return;
		}
		// method check
		if (typeof (current_handler[json.method]) === "function" ) {
			logger ('Calling method ' + json.method, 'info');
			current_handler[json.method](current_env, req, json.params, function (err, result) {
				if (err) {
					logger('Method error:', err);
					resp.end(make_jsonrpc_response (json.id, errs.handlererror, err));
					return;
				} else {
					resp.end(make_jsonrpc_response(json.id, null, result));
				}
			});
		} else {
			logger ('Method ' + json.method + ' not found', 'warn');
			resp.end(make_jsonrpc_response(json.id, errs.methodnotfound));
			return;
		}
	});
}

module.exports = jsonrpc;
