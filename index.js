'use strict';

var async 				= require('async');
var url 				= require('url');
var log 				= require('simple-color-log');
var defaultConfig 		= require('./lib/default_config');
var tv4 				= require('tv4');
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
var checkJsonrpc = function(results, cb) {
	var json = results.parse;
	if ( ! isJsonrpcProtocol(json) ) {
		log.error('Not jsonrpc protocol,' + JSON.stringify(json));
		return cb(errors.parseError);
	}
	cb(null, json);
};
var validateParams = function(env, validator) {
	return function(results, cb) {
		var json = results.parse;
		log.debug('HANDLER:', validator);
		var valid = tv4.validate(json.params, validator[json.method]);
		if ( ! valid) {
			log.error('Params not validated by user schema:', json);
			log.error(tv4.error.message);
			return cb(errors.invalidParams);
		}
		cb(null, json);
	};
};
var callMethod = function(currentEnv, currentHandler, req) {
	return function(results, cb) {
		var json = results.parse;
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
	var currentValidator = {};
	if (method.toLowerCase() !== 'post') {
		log.error('Non-post request:', method);
		resp.writeHead(403);
		resp.end();
		return;
	}
	if (typeof (run.services[uri]) === 'object' && run.services[uri] !== null) {
		currentHandler = run.services[uri].handler;
		currentEnv = run.services[uri].env || {};
		currentValidator = run.services[uri].validator || {};
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
		async.auto({
			parse: tryParse(body),
			jsonrpcCompliance: ['parse', checkJsonrpc],
			validateParams: ['parse', 'jsonrpcCompliance', validateParams(currentEnv, currentValidator)],
			callMethod: ['validateParams', callMethod(currentEnv, currentHandler, req)]
		}, function(err, results) {
			var json = results.parse;
			if (err) {
				if (json) {
					return resp.end(makeJsonrpcResponse(json.id, err));
				}
				return resp.end(makeJsonrpcResponse(null, err));
			}
			resp.end(makeJsonrpcResponse(json.id, null, results.callMethod));
		});
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
			handler: item.handler,
			validator: item.validator
		};
		run.services[srv].env = run.masterEnv;
		for (var key in item.env) {
			if (item.env.hasOwnProperty(key)) {
				run.services[srv].env[key] = item.env[key];
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
