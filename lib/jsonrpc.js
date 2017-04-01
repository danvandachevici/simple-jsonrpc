'use strict';

var async               = require('async');
var url                 = require('url');
var log                 = require('simple-color-log');
var tv4                 = require('tv4');

var defaultConfig       = require('./default_config');
var errors              = require('./Errors');

var jsonrpc             = {};

jsonrpc.libCanInit = function(initobj) {
    /* Check init object is an object with keys in it */
    if (typeof initobj !== 'object' ||
        initobj === null ||
        Object.keys(initobj).length === 0) {
        return errors.noInit;
    }

    /* Check whether the routes key exists and it's an array */
    if ( ! (initobj.routes instanceof Object ) ||
        (! Array.isArray(initobj.routes)) ||
        initobj.routes.length === 0) {
        return errors.noRoutes;
    }

    /* Check each route definition is an object with at least a handler option */
    /* Check possible properties of routes (route, validator,
    handler, middleware, etc) */
    for (var i = 0; i < initobj.routes.length; i++) {
        var routeobj = initobj.routes[i];
        if (typeof (routeobj) !== 'object' || routeobj === null) {
            return errors.wrongRoute;
        }
        if ( ! routeobj.hasOwnProperty('route') ||
            ! routeobj.hasOwnProperty('handler')) {
            return errors.wrongRoute;
        }
        if (typeof routeobj.route !== 'string') {
            return errors.wrongRoute;
        }
        if (typeof routeobj.handler !== 'object' ||
            Object.keys(routeobj.handler).length === 0 ) {
            return errors.wrongRoute;
        }
        if (typeof routeobj.validator === 'object' &&
            Object.keys(routeobj.validator).length === 0 ) {
            return errors.wrongRoute;
        }
    }
    return errors.ok;
};
jsonrpc.isJsonrpcProtocol = function(json) {
    if (json.jsonrpc !== '2.0' ||
        typeof (json.method) !== 'string' ||
        json.method.match('^rpc\.') ) {
        return false;
    }
    return true;
};
jsonrpc.makeJsonrpcResponse = function(id, err, data) {
    if (id === null) {
        // randomize the id:
        id = 4; // :)
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
jsonrpc.tryParse = function(body) {
    return function(cb) {
        var json;
        try {
            json = JSON.parse(body);
        } catch (e) {
            log.error('Could not parse json:' + body);
            log.error('Parse error:', e);
            return cb(errors.parseError);
        }
        cb(null, json);
    };
};
jsonrpc.checkJsonrpc = function(results, cb) {
    var json = results.parse;
    if ( ! jsonrpc.isJsonrpcProtocol(json) ) {
        log.error('Not jsonrpc protocol,' + JSON.stringify(json));
        return cb(errors.parseError);
    }
    cb(null, json);
};
jsonrpc.validateParams = function(route) {
    return function(results, cb) {
        var json = results.parse;
        if ( ! route.validator || ! route.validator[json.method]) {
            return cb(null);
        }
        var valid = tv4.validate(json.params, route.validator[json.method]);
        if ( ! valid) {
            log.error('Params not validated by user schema:', json);
            log.error(tv4.error.message);
            return cb(errors.invalidParams);
        }
        cb(null, json);
    };
};
jsonrpc.callMethod = function(req, route) {
    return function(results, cb) {
        var json = results.parse;
        if (typeof (route.handler[json.method]) !== 'function' ) {
            return cb(errors.methodNotFound);
        }
        route.handler[json.method](route.env, req, json.params, function(err, result) {
            return cb(err, result);
        });
    };
};
jsonrpc.middlewareIterator = function(req, resp, params, route) {
    return function(middleMethod, cb) {
        middleMethod(req, resp, params, route, function(err, results) {
            cb(err, results);
        });
    };
};
jsonrpc.runMiddleware = function(req, resp, when, route) {
    return function(results, cbAuto) {
        if (route.middleware &&
            route.middleware[when] &&
            Array.isArray(route.middleware[when]) &&
            route.middleware[when].length > 0 ) {

            var params = results.parse;
            var middleware = route.middleware[when];
            for (var i = 0; i < middleware.length; i++) {
                if ( typeof (middleware[i]) !== 'function') {
                    return cbAuto(errors.weirdMiddleware);
                }
            }

            async.eachSeries(middleware, jsonrpc.middlewareIterator(req, resp, params, route), function(err) {
                if (err) {
                    return cbAuto(errors.middlewareError);
                }
                cbAuto(null);
            });
        } else {
            cbAuto(null);
        }
    };
};
jsonrpc.requestHandler = function(run) {
    return function(req, resp) {
        /*
        * figure out the path / service.
        * check it's post http method
        * check there is such a route defined
        * register listeners for http events
        */

        var method = req.method;
        if (method.toLowerCase() !== 'post') {
            log.error('Non-post request:', method);
            resp.writeHead(403);
            resp.end();
            return;
        }

        var uri = url.parse(req.url).pathname;

        if (typeof (run.services[uri]) !== 'object' || ! run.services[uri]) {
            log.error('No such uri:', uri, run.services[uri]);
            resp.writeHead(403);
            resp.end();
            return;
        }

        var route = run.services[uri];
        if ( ! route.handler ) {
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
                resp.end(jsonrpc.makeJsonrpcResponse(null, errors.invalidRequest));
                req.connection.destroy();
                return;
            }
        });


        req.on('end', function() {
            async.auto({
                parse: jsonrpc.tryParse(body),
                jsonrpcCompliance: ['parse', jsonrpc.checkJsonrpc],
                validateParams: ['parse', 'jsonrpcCompliance', jsonrpc.validateParams(route)],
                runPreMiddleware: ['parse', 'validateParams', jsonrpc.runMiddleware(req, resp, 'before', route)],
                callMethod: ['parse', 'runPreMiddleware', 'validateParams', jsonrpc.callMethod(req, route)],
                runPostMiddleware: ['parse', 'callMethod', jsonrpc.runMiddleware(req, resp, 'after', route)]
            }, function(err, results) {
                var json = results.parse;
                if (err) {
                    if (json) {
                        return resp.end(jsonrpc.makeJsonrpcResponse(json.id, err));
                    }
                    return resp.end(jsonrpc.makeJsonrpcResponse(null, err));
                }
                resp.end(jsonrpc.makeJsonrpcResponse(json.id, null, results.callMethod));
            });
        });
    };
};
jsonrpc.init = function(initobj, cb) {

    /*
    * check init object;
    * merge default values;
    * init the lib
    */

    var err = jsonrpc.libCanInit(initobj);
    if ( err.code ) {       // error.code !== 0
        log.error('Library can\'t init. ' + err.message);
        return cb(err);
    }

    var run                 = {};
    run.masterConfig        = {};
    run.masterEnv           = {};
    run.services            = {};

    if ( ! initobj.maxRequestDataSize ) {
        initobj.maxRequestDataSize = defaultConfig.maxRequestDataSize;
    }

    run.masterConfig = {
        env: initobj.env || {},
        routes: initobj.routes,
        maxRequestDataSize: initobj.maxRequestDataSize || defaultConfig.maxRequestDataSize
    };

    run.services = {};

    /* Set the master environment */
    if (typeof initobj.env === 'object' &&
        initobj.env !== null &&
        Object.keys(initobj.env).length !== 0) {
        run.masterEnv = initobj.env;
    }
    var iterator = function(item, cbIt) {
        var srv = item.route;
        run.services[srv] = {
            handler: item.handler,
            validator: item.validator,
            middleware: item.middleware,
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
            cb(null, jsonrpc.requestHandler(run));
        }
    });
};

module.exports = jsonrpc;
