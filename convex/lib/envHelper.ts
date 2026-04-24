import { query } from "../_generated/server";
import type { GenericDatabaseReader } from "convex/server";
import type { DataModel } from "../_generated/dataModel";

/**
 * Get an environment variable from process.env OR the runtimeConfig table.
 * Use in queries/mutations where ctx.db is available.
 */
export async function getEnvFromDb(
	db: GenericDatabaseReader<DataModel>,
	key: string
): Promise<string | undefined> {
	const envVal = process.env[key];
	if (envVal) return envVal;
	try {
		const config = await db
			.query("runtimeConfig")
			.withIndex("by_key", (q) => q.eq("key", key))
			.first();
		return config?.value ?? undefined;
	} catch {
		return undefined;
	}
}

/**
 * Query that returns all runtime config values as a Record.
 * Used by actions via ctx.runQuery to get API keys.
 */
export const getAllConfig = query({
	args: {},
	handler: async (ctx) => {
		const configs = await ctx.db.query("runtimeConfig").collect();
		const result: Record<string, string> = {};
		for (const c of configs) {
			result[c.key] = c.value;
		}
		return result;
	},
});

/**
 * Helper for actions: gets an env var checking process.env first, then config map.
 */
export function resolveEnv(
	configMap: Record<string, string>,
	key: string
): string | undefined {
	return process.env[key] || configMap[key] || undefined;
}
