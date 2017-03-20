var errs = {
	ok: {code: 0},

	parseError: {code: -32700, message: "Parse error"},
	invalidRequest: {code: -32600, message: "Invalid request"},
	methodNotFound: {code: -32601, message: "Method not found"},
	invalidParams: {code: 32602, message: "Invalid params"},
	internalError: {code: 32603, message: "Internal error"},

	noInit: {code: -32001, message: "Server error: No init object"},
	noRoutes: {code: -32002, message: "Server error: No routes in init object"},
	wrongRoute: {code: -32003, message: "Server error: Wrong route config in one of the routes"},
	handlerError: {code: -32004, message: "Handler error"},
    weirdMiddleware: {code: -32005, message: "Some middleware you provided cannot be called. Is it a function ?"},
    middlewareError: {code: -32006, message: "An error occured while processing middleware."}
};

module.exports = errs