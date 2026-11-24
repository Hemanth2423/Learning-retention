import { httpRouter } from "convex/server";
import { auth } from "./auth";

import { callback } from "./notion";

const http = httpRouter();
auth.addHttpRoutes(http);
http.route({ path: "/oauth/notion/callback", method: "GET", handler: callback });

export default http;
