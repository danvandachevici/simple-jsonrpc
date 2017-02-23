'use strict';

var async 				= require('async');
var url 				= require('url');
var log 				= require('simple-color-log');
var defaultConfig 		= require('./lib/default_config');
var errors 				= require('./lib/Errors');

var jsonrpc 			= {};
var run 				= {};
run.masterConfig 		= {};
run.masterEnv 			= {};
run.services 			= {};

var libCanInit = jsonrpc.libCanInit = function(initobj) {
	if (typeof initobj !== 'object' ||
		initobj === null ||
		Object.keys(initobj).length === 0) {
		return errors.noInit;
	}
	if ( ! (initobj.routes instanceof Object ) ) {
		return errors.noRoutes;
	}
	if (Object.keys(initobj.routes).length === 0) {
		return errors.noRoutes;
	}
	for (var i = 0; i < initobj.routes.length; i++) {
		if (typeof (initobj.routes[i]) !== 'object' || initobj.routes[i] === null) {
			return errors.wrongRoute;
		}
		if ( ! initobj.routes[i].hasOwnProperty('route') ||
			! initobj.routes[i].hasOwnProperty('handler')) {
			return errors.wrongRoute;
		}
	}
	return errors.ok;
};
var isJsonrpcProtocol = function(json) {
	if (json.jsonrpc !== '2.0' ||
		typeof (json.method) !== 'string' ||
		json.method.match('^rpc\.') ) {
		return false;
	}
	return true;
};
var makeJsonrpcResponse = function(id, err, data) {
	if (id === null) {
		// randomize the id:
		id = 4;	// :)
	}
	var resp = {
		jsonrpc: '2.0',
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
var tryParse = function(body) {
	return function(cb) {
		var json;
		try {
			json = JSON.parse(body);
		} catch (e) {
			log.error('Could not parse json:' +JSON.stringify(body) + ' because:', e);
			// resp.writeHead(400, {'Content-Type': 'application/json'});
			// resp.end (makeJsonrpcResponse(null, errors.parseError));
			return cb(errors.parseError);
		}
		cb(null, json);
	};
};
var checkJsonrpc = function(cb, json) {
	if ( ! isJsonrpcProtocol(json) ) {
		log.error('Not jsonrpc protocol,' + JSON.stringify(json));
		// resp.writeHead(400, {'Content-Type': 'application/json'});
		// resp.end(makeJsonrpcResponse(null, errors.parseError));
		return cb(errors.parseError);
	}
	cb(null, json);
};
var validateParams = function(cb, json) {
};
var callMethod = function(currentEnv, currentHandler, req) {
	return function(cb, json) {
		if (typeof (currentHandler[json.method]) !== 'function' ) {
			return cb(errors.methodNotFound);
		}
		currentHandler[json.method](currentEnv, req, json.params,
			function(err, result) {
			return cb(err, result);
		});
	};
};
var requestHandler = function(req, resp) {
	var uri = url.parse(req.url).pathname;
	var method = req.method;
	var currentHandler = null;
	var currentEnv = null;
	if (method.toLowerCase() !== 'post') {
		log.error('Non-post request:', method);
		resp.writeHead(403);
		resp.end();
		return;
	}
	if (typeof (run.services[uri]) === 'object' && run.services[uri] !== null) {
		currentHandler = run.services[uri].handler;
		currentEnv = run.services[uri].env;
	} else {
		log.error('No such uri:', uri, run.services[uri]);
		resp.writeHead(403);
		resp.end();
		return;
	}
	if (currentHandler === null) {
		log.error('No such handler');
		resp.writeHead(404);
		resp.end();
		return;
	}
	var body = '';
	req.on('data', function(data) {
		body += data;
            // Too much POST data, kill the connection!
		if (body.length > run.masterConfig.maxRequestDataSize) {
			log.error('Received body length,' + body.length +
				' bytes is larger than the preset max body size:' +
				run.masterConfig.maxRequestDataSize + 'bytes');
			resp.writeHead(413, {'Content-Type': 'application/json'});
			resp.end(makeJsonrpcResponse(null, errors.invalidRequest));
			req.connection.destroy();
			return;
		}
	});
	req.on('end', function() {
		async.waterfall([
			tryParse(body),
			checkJsonrpc,
			validateParams,
			callMethod(currentEnv, currentHandler, req)
		], function(err, results) {
			/*
				TODO:
				rezolva problema cu tratarea erorilor aici
			*/
		});

		// method check
		/*
		if (typeof (currentHandler[json.method]) === 'function' ) {
			currentHandler[json.method](currentEnv,
			req, json.params, function (err, result) {
				if (err) {
					log.error('Method error:', err);
					resp.writeHead(200, {'Content-Type': 'application/json'});
					resp.end(makeJsonrpcResponse (json.id, errors.handlerError, err));
					return;
				} else {
					resp.writeHead(200, {'Content-Type': 'application/json'});
					resp.end(makeJsonrpcResponse(json.id, null, result));
				}
			});
		} else {
			log.error('Method ' + json.method + ' not found');
			resp.writeHead(404, {'Content-Type': 'application/json'});
			resp.end(makeJsonrpcResponse(json.id, errors.methodNotFound));
			return;
		}
		*/
	});
};
jsonrpc.init = function(initobj, cb) {
	if ( ! initobj.maxRequestDataSize ) {
		initobj.maxRequestDataSize = defaultConfig.maxRequestDataSize;
	}
	run.masterConfig = {
		env: initobj.env || {},
		routes: initobj.routes || [],
		maxRequestDataSize: initobj.maxRequestDataSize
	};
	run.services = {};

	if (typeof initobj.env === 'object' &&
		initobj.env !== null &&
		Object.keys(initobj.env).length !== 0) {
		run.masterEnv = initobj.env;
	}
	var err = libCanInit(initobj);
	if ( err.code ) {		// error.code !== 0
		log.error('Library can\'t init.' + err.message);
		return cb(err);
	}
	var iterator = function(item, cbIt) {
		var srv = item.route;
		run.services[srv] = {
			handler: item.handler
		};
		run.services[srv].env = run.masterEnv;
		if (typeof (item.env) === 'object' &&
			item.env !== null && Object.keys(item.env).length !== 0) {
			for (var key in item.env) {
				if (item.env.hasOwnProperty(key)) {
					run.services[srv].env[key] = item.env[key];
				}
			}
		}
		cbIt(null);
	};
	async.each( initobj.routes, iterator, function(err) {
		if (err) {
			log.error('Library can\'t init.' + err);
			return cb(err);
		} else {
			cb(null, requestHandler);
		}
	});
};

module.exports = jsonrpc;
