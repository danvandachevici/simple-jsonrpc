exports.add = function (env, req, params, cb) {
	if (typeof (params.a) === "undefined") {
		return cb(null, env.increment);
	}
	if (typeof (params.b) === "undefined") {
		cb(null, params.a + env.increment);
	} else {
		cb(null, params.a + params.b);
	}
};
