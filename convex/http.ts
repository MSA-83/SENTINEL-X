import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { setConfigHttp } from "./configApi";

const http = httpRouter();
auth.addHttpRoutes(http);

// Config API endpoint for setting runtime config (API keys)
http.route({
	path: "/setConfig",
	method: "POST",
	handler: setConfigHttp,
});

export default http;
