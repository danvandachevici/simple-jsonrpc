"use strict"

var async 				= require('async');
var url 				= require("url");
var log 				= require ('simple-color-log');

var defaultConfig 		= require ('./lib/default_config');
var errors 				= require ('./lib/Errors');

var jsonrpc 			= {};
var run 				= {};
run.masterConfig 		= {};
run.masterEnv 			= {};
run.services 			= {};


var lib_can_init = jsonrpc.lib_can_init = function (initobj) {
	if (typeof initobj !== 'object' || initobj === null || Object.keys(initobj).length === 0){
		return errors.noInit;
	}
	if ( ! (initobj.routes instanceof Object ) ) {
		return errors.noRoutes;
	}
	if (Object.keys(initobj.routes).length === 0) {
		return errors.noRoutes;
	}
	for (var i = 0; i < initobj.routes.length; i++) {
		if (typeof (initobj.routes[i]) !== "object" || initobj.routes[i] === null){
			return errors.wrongRoute;
		}
		if ( ! initobj.routes[i].hasOwnProperty('route') || ! initobj.routes[i].hasOwnProperty('handler')) {
			return errors.wrongRoute;
		}
	}
	return errors.ok;
};
var is_jsonrpc_protocol = function (json) {
	if (json.jsonrpc !== "2.0" || typeof (json.method) !== "string" || json.method.match('^rpc\.') ) {
		return false;
	}
	return true;
};
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
};
jsonrpc.requestHandler = function (req, resp) {
	var uri = url.parse(req.url).pathname;
	log.debug("Received request to " + uri);
	var method = req.method;
	var currentHandler = null;
	var currentEnv = null;
	if (typeof (run.services[uri]) === "object" && run.services[uri] !== null) {
		currentHandler = run.services[uri].handler;
		currentEnv = run.services[uri].env;
	} else {
		resp.writeHead(403);
		resp.end();
		return;
	}
	if (currentHandler === null) {
		resp.writeHead(404);
		resp.end();
		return;
	}
	resp.writeHead(200, {'Content-Type': 'application/json'})
	var body = '';
	var json = null;
	req.on('data', function (data) {
		body += data;
            // Too much POST data, kill the connection!
		if (body.length > run.masterConfig.maxRequestDataSize) {
			log.error('Received body length,' + body.length + ' bytes is larger than the preset max body size:' + run.masterConfig.maxRequestDataSize + 'bytes');
			resp.end(make_jsonrpc_response(null, errors.invalidRequest));
			req.connection.destroy();
			return;
		}
	});
	req.on('end', function () {
		try {
			json = JSON.parse(body);
		} catch (e) {
			log.error ("Could not parse json:" +JSON.stringify(body) + " because:", e);
			resp.end (make_jsonrpc_response(null, errors.parseError));
			return;
		}
		if ( ! is_jsonrpc_protocol(json) ) {
			log.error ("Not jsonrpc protocol," + JSON.stringify(json));
			resp.end(make_jsonrpc_response(null, errors.parseError));
			return;
		}
		// method check
		if (typeof (currentHandler[json.method]) === "function" ) {
			log.debug ('Calling method ' + json.method);
			currentHandler[json.method](currentEnv, req, json.params, function (err, result) {
				if (err) {
					log.error('Method error:', err);
					resp.end(make_jsonrpc_response (json.id, errors.handlerError, err));
					return;
				} else {
					resp.end(make_jsonrpc_response(json.id, null, result));
				}
			});
		} else {
			log.error('Method ' + json.method + ' not found');
			resp.end(make_jsonrpc_response(json.id, errors.methodNotFound));
			return;
		}
	});
};
jsonrpc.init = function (initobj, cb) {
	if ( ! initobj.maxRequestDataSize ){
		initobj.maxRequestDataSize = defaultConfig.maxRequestDataSize;
	}
	run.masterConfig = {
		env: initobj.env || {},
		routes: initobj.routes || [],
		maxRequestDataSize: initobj.maxRequestDataSize
	};
	run.services = {};

	log.debug('Initializing routes...');
	if (typeof initobj.env === "object" && initobj.env !== null && Object.keys(initobj.env).length !== 0) {
		run.masterEnv = initobj.env;
	}
	var err = lib_can_init(initobj);
	if ( err.code ) {		// error.code !== 0
		log.error ("Library can't init." + err.message);
		return cb(err);
	}
	var iterator = function (item, cb_it) {
		var srv = item.route;
		run.services[srv] = {
			handler: item.handler
		};
		run.services[srv].env = run.masterEnv;
		if (typeof (item.env) === "object" && item.env !== null && Object.keys(item.env).length !== 0) {
			for (var key in item.env) {
				run.services[srv].env[key] = item.env[key];
			}
		}
		log.debug('Registered route ' + srv);
		cb_it(null);
	};
	async.each (initobj.routes, iterator, function(err) {
		if (err) {
			log.error ("Library can't init." + err);
			return cb(err);
		} else {
			log.info ('Done initializing routes');
			log.debug("Init obj: ", run);
			cb(null, null);
		}
	});
};

module.exports = jsonrpc;
