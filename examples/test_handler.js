module.exports = {
	test_func: function (env, req, params, cb) {
	},
	test_func2: function (env, req, params, cb) {
	},
	add: function (env, req, params, cb) {
        console.log ("Received params:", params);
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
