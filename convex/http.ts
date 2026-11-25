import { httpRouter } from "convex/server";
import { auth } from "./auth";

import { callback as googleCallback } from "./google";
import { callback as notionCallback } from "./notion";

const http = httpRouter();
auth.addHttpRoutes(http);
http.route({ path: "/oauth/notion/callback", method: "GET", handler: notionCallback });
http.route({ path: "/oauth/google/callback", method: "GET", handler: googleCallback });

export default http;
