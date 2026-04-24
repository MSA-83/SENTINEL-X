import { httpAction } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Secret token to protect the endpoint (simple bearer auth)
const CONFIG_SECRET = "sx-config-2026-secure-token";

/**
 * HTTP action to set runtime config keys (API keys etc.)
 * POST /setConfig with JSON body: { token: string, keys: Record<string, string> }
 */
export const setConfigHttp = httpAction(async (ctx, request) => {
	if (request.method !== "POST") {
		return new Response("Method not allowed", { status: 405 });
	}

	try {
		const body = await request.json();
		const { token, keys } = body as { token: string; keys: Record<string, string> };

		if (token !== CONFIG_SECRET) {
			return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
		}

		if (!keys || typeof keys !== "object") {
			return new Response(JSON.stringify({ error: "Invalid body: expected { token, keys }" }), { status: 400 });
		}

		// Store each key via mutation
		const results: Record<string, string> = {};
		for (const [key, value] of Object.entries(keys)) {
			await ctx.runMutation(api.configApi.upsertConfig, { key, value });
			results[key] = "set";
		}

		return new Response(JSON.stringify({ success: true, results }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (e: any) {
		return new Response(JSON.stringify({ error: e.message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
});

/** Public mutation to upsert a config key */
export const upsertConfig = mutation({
	args: { key: v.string(), value: v.string() },
	handler: async (ctx, { key, value }) => {
		const existing = await ctx.db
			.query("runtimeConfig")
			.withIndex("by_key", (q) => q.eq("key", key))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, { value, updatedAt: Date.now() });
		} else {
			await ctx.db.insert("runtimeConfig", { key, value, updatedAt: Date.now() });
		}
	},
});

/** Query to list all config keys (names only, not values for security) */
export const listConfigKeys = query({
	args: {},
	handler: async (ctx) => {
		const configs = await ctx.db.query("runtimeConfig").collect();
		return configs.map((c) => ({
			key: c.key,
			hasValue: !!c.value,
			updatedAt: c.updatedAt,
		}));
	},
});
