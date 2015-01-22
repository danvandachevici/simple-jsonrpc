var url = require("url");
var jsonrpc = {};

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

var lib_can_init = function (initobj) {
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
	if (typeof initobj.env === "object" && initobj.env !== null && Object.keys(initobj.env).length !== 0) {
		master_env = initobj.env;
	}
	var err = lib_can_init(initobj);
	if ( err.code !== 0 ) {
		console.log ("Library can't init." + err.message);
		return cb(err);
	}
	for (var i = 0; i < initobj.routes.length; i++){
		var r = initobj.routes[i];
		var srv = r.route;
		services[srv] = {
			handler: r.handler
		};
		services[srv].env = master_env;
		if (typeof (r.env) === "object" && r.env !== null && Object.keys(r.env).length !==0) {
			for (var key in r.env) {
				services[srv].env[key] = r.env[key];
			}
		}
		cb(null, null);
	}
};
var is_jsonrpc_protocol = function (js) {
	if (js.jsonrpc !== "2.0" || typeof (method) !== "string" || method.match('^rpc\.') ) {
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
	var url = url.parse(req.url).pathname;
	var method = req.method;
	var current_handler = null;
	//for (var i = 0; i < services.length; i++) {
	//	if (url.match(services[i].route)) {
	//		current_handler = services[i].handler;
	//		break;
	//	}
	//}
	if (typeof (services[url]) === "object" && services[url] !== null) {
		current_handler = services[url].handler;
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
			resp.end (make_jsonrpc_response(json.id, errs.parseerror));
			return;
		}
		if ( ! is_jsonrpc_protocol(json) ) {
			resp.end(make_jsonrpc_response(json.id, errs.parseerror));
			return;
		}
		// method check
		if (typeof (current_handler[json.method]) === "function" ) {
			current_handler[json.method](env, req, json.params, function (err, result) {
				if (err) {
					resp.end(make_jsonrpc_response (json.id, errs.handlererror, err));
					return;
				}
				resp.end(make_jsonrpc_response(json.id, null, result));
			})
		} else {
			resp.end(make_jsonrpc_response(json.id, errs.methodnotfound));
			return;
		}
	});
}

module.exports = jsonrpc;
