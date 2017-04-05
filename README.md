[![Build Status](https://travis-ci.org/toranaga-samma/simple-jsonrpc.svg?branch=master)](https://travis-ci.org/toranaga-samma/simple-jsonrpc)

# simple-jsonrpc
A quick and easy-to-use library for JSON-RPC server.

1. [What's this](#whatsthis)
2. [Install](#install)
2. [Basic usage](#usage)
3. [Environments](#environments)
    1. [Precedence](#environments-precedence)
    2. [Use cases](#environments-usecases)
3. [Validation](#validation)
4. [Middleware](#middleware)



## What is this ?<a name="whatsthis"></a>
This is a library that helps servers implement the JSONRPC 2.0 standard, with some additions.

## Installation<a name="install"></a>

    npm install simple-jsonrpc-server

## Basic usage<a name="usage"></a>
In order to start a server that listens for HTTP requests, simply initiate the lib with a very basic *json* object. This will provide you with a handle. Passing that handle to a HTTP server will enable your JSONRPC server.

Example:

*index.js*

    var jsonrpc = require ('simple-jsonrpc-server');

    var http = require('http');
    
    var jsonrpc_init_obj = {
        routes: [
            {
                route: '/api/test',
                handler: require('./handler.js')
            }
        ]
    }
    
    jsonrpc.init(jsonrpc_init_obj, function (err, handler) {
        http.createServer(handler).listen(9615);
    });

This will create an HTTP server that listens on port 9615. Whenever a request arrives, it will unpack the request (sent with the content-type header set to 'application/json'), check for a **method** property in the data, and pass the request to that method, if it exists in the handler.

Handler sample:

*handler.js*

    var exp = {};
    exp.add = function (env, req, params, cb) {
        cb(null, params.a + params.b);
    };

    module.exports = exp;


## Environments<a name="environments"></a>

Passing environments to the exported methods is easy. Simply define **env** objects for each route, or a master **env**

Example:

*index.js*

    var jsonrpc = require ('simple-jsonrpc-server');
    
    var http = require('http');
    
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
    
    jsonrpc.init(jsonrpc_init_obj, function (err, handler) {
        http.createServer(handler).listen(9615);
    });

We have added an increment environment variable to the */api/test* handler. And a master **env** key, with the value 'value', in case we need it somewhere, in our routes handlers.

*handler.js*

    module.exports = {
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

Now we can handle the request and add 2 numbers even if there are 2 numbers passed in, one number, or no number at all. We'll consider the increment to be whatever was set in the route **env** (in this case, the increment is 4);

### Precedence<a name="#environments-precedence"></a>

The most specific definition of an environment takes precedence.
What this means, is that, if you've set no environment variable whatsoever, but you're looking for the "increment" key, it won't be found, so its value is *undefined*.
If you set the key in the master environment, this value will be used.
If you ALSO set it in the route environment (as well as in the master environment), this route environment value will be used.

*index.js*
    
    var jsonrpc = require ('simple-jsonrpc-server');
    
    var http = require('http');
    var fs = require('fs');
    
    var jsonrpc_init_obj = {
        env: {
            increment: 1
        },
        routes: [
            {
                route: '/api/additions',
                handler: require('./additions.js'),
                env: {
                    increment: 4
                }
            },
            {
                route: '/api/subtractions',
                handler: require('./subtractions.js')
            }
        ]
    }
    
    jsonrpc.init(jsonrpc_init_obj, function (err, handler) {
        http.createServer(handler).listen(9615);
    });

*additions.js*

    module.exports = {
        add: function (env, req, params, cb) {
            cb(null, params.a + env.increment);  // <-- this will add a 4 to the value of params.a
        }
    }

*subtractions.js*

    module.exports = {
        subtract: function (env, req, params, cb) {
            cb(null, params.a - env.increment); // <-- this will subtract 1, since this route didn't have an increment defined in its environment, but there is one in the master env.
        }
    };

### Common use cases<a name="#environments-usecases"></a>

One of the most used use-cases is the one where you provide specific resources for a route. For example, you have a database for your business logic data, and a user database for authentication & others. You will only need to provide the business logic data for the routes that handle that kind of data. You don't want that data to be available on all routes.
It's kind of a data isolation.


## Validation<a name="validation"></a>

Validating your input is always a great idea !
A common tool for doing this is the [Tiny Validator](https://github.com/geraintluff/tv4)
In order to use validation with your JSONRPC APIs, simply add another property to the configuration object of JSONRPC lib.

*index.js*

    var jsonrpc = require ('simple-jsonrpc-server');
    
    var http = require('http');
    var fs = require('fs');
    
    var jsonrpc_init_obj = {
        routes: [
            {
                route: '/api/test',
                handler: require('./handler.js'),
                validator: require('./validation_schema.js'),
            }
        ]
    }
    
    jsonrpc.init(jsonrpc_init_obj, function (err, handler) {
        http.createServer(handler).listen(9615);
    });

*validation_schema.js*

    module.exports = {
        add: {
            type: "object",
            required: ["a"],
            properties: {
                a: {type: "number"},
                b: {type: "number"}
            }
        }
    }

The **validator** property above specifies what the validator looks like.
The required file simply exports an object with the root properties being the names of methods that are validated. In this case, our *add* function is validated through TV4 syntax.


So now, if you won't receive your **a** property in the **params** object, in your exported **add** function, input will be validated and answered ASAP, if invalid. The request won't reach your function, so no extra validation is required. 
Check out TV4 syntax, to make use of all the features.


## Middleware<a name="middleware"></a>

Say you want to do some extra stuff before or after your business logic. For example, you need to log requests and responses, or you might need to authenticate your users' requests. Or you might need to do some decrypting the request & encrypting the response, and so on.
Basically things that should not alter the business logic, and you want to keep them separate.

This is when you might need ... Middleware ! 

    var jsonrpc = require ('simple-jsonrpc-server');
    
    var http = require('http');
    var fs = require('fs');

    var authenticate = function (req, resp, params, route, cb) {
        if (params.user && params.user.token) {
            // check token
            if (params.user.token === "token id 1") {
                cb(null);
            } else {
                cb(new Error('Invalid token')); // this will stop the execution and respond to the user.
            }
        }
    };
    
    var jsonrpc_init_obj = {
        routes: [
            {
                route: '/api/test',
                handler: require('./handler.js'),
                middleware: {
                    before: [authenticate /*, Array of functions to be run in order, before business logic*/],
                    after: [/*Array of methods to be run in order, after business logic*/]
                },
                env: {
                    increment: 4,
                }
            }
        ]
    };
    
    jsonrpc.init(jsonrpc_init_obj, function (err, handler) {
        http.createServer(handler).listen(9615);
    });

Simply respond from the middleware, and decide whether you want the request to go forward to the methods, or not.


## Batch requests

Not implemented yet

## GET requests

Not implemented yet
