/**
 * OpenWeatherMap — Weather data for key Areas of Interest
 * https://openweathermap.org/current
 * 
 * Circuit breaker: If 5 consecutive failures, circuit opens and returns cached data
 */
import { internalAction, internalMutation } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { v } from "convex/values";
import { resolveEnv } from "../lib/envHelper";

// Strategic monitoring points
const AOI_POINTS = [
	{ id: "kyiv", name: "Kyiv", lat: 50.45, lon: 30.52 },
	{ id: "khartoum", name: "Khartoum", lat: 15.59, lon: 32.53 },
	{ id: "taipei", name: "Taipei", lat: 25.03, lon: 121.57 },
	{ id: "eastern-med", name: "Nicosia", lat: 35.17, lon: 33.36 },
	{ id: "hormuz", name: "Strait of Hormuz", lat: 26.59, lon: 56.26 },
	{ id: "bab-mandeb", name: "Bab el-Mandeb", lat: 12.59, lon: 43.33 },
	{ id: "kaliningrad", name: "Kaliningrad", lat: 54.71, lon: 20.51 },
	{ id: "south-china-sea", name: "Spratly Islands", lat: 11.0, lon: 114.0 },
	{ id: "black-sea", name: "Sevastopol", lat: 44.62, lon: 33.52 },
	{ id: "gaza", name: "Gaza", lat: 31.50, lon: 34.47 },
];

interface WeatherEntry {
	id: string;
	name: string;
	lat: number;
	lon: number;
	temp: number;
	humidity: number;
	windSpeed: number;
	windDeg: number;
	pressure: number;
	visibility: number;
	description: string;
	icon: string;
}

export const fetchWeather = internalAction({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const _cfg = await ctx.runQuery(api.lib.envHelper.getAllConfig);
		const apiKey = resolveEnv(_cfg, "OPENWEATHER_KEY");
		if (!apiKey) {
			await ctx.runMutation(internal.integrations.helpers.updateSourceStatus, {
				sourceId: "openweather", name: "OpenWeatherMap", status: "error", recordCount: 0,
				errorMessage: "Missing OPENWEATHER_KEY",
			});
			return null;
		}

		try {
			const results: WeatherEntry[] = [];

			for (const point of AOI_POINTS) {
				const url = `https://api.openweathermap.org/data/2.5/weather?lat=${point.lat}&lon=${point.lon}&appid=${apiKey}&units=metric`;
				const resp = await fetch(url);
				if (!resp.ok) continue;
				const data = await resp.json();

				results.push({
					id: point.id,
					name: point.name,
					lat: point.lat,
					lon: point.lon,
					temp: data.main?.temp ?? 0,
					humidity: data.main?.humidity ?? 0,
					windSpeed: data.wind?.speed ?? 0,
					windDeg: data.wind?.deg ?? 0,
					pressure: data.main?.pressure ?? 0,
					visibility: data.visibility ?? 10000,
					description: data.weather?.[0]?.description ?? "clear",
					icon: data.weather?.[0]?.icon ?? "01d",
				});
			}

			await ctx.runMutation(internal.integrations.openweather.storeWeather, { entries: results });
			await ctx.runMutation(internal.integrations.helpers.updateCircuitBreaker, {
				sourceId: "openweather",
				success: results.length > 0,
				recordCount: results.length,
			});
		} catch (e) {
			await ctx.runMutation(internal.integrations.helpers.updateCircuitBreaker, {
				sourceId: "openweather",
				success: false,
				errorMessage: String(e),
			});
		}
		return null;
	},
});

export const storeWeather = internalMutation({
	args: {
		entries: v.array(v.object({
			id: v.string(),
			name: v.string(),
			lat: v.number(),
			lon: v.number(),
			temp: v.number(),
			humidity: v.number(),
			windSpeed: v.number(),
			windDeg: v.number(),
			pressure: v.number(),
			visibility: v.number(),
			description: v.string(),
			icon: v.string(),
		})),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const now = Date.now();
		for (const entry of args.entries) {
			const existing = await ctx.db
				.query("weatherData")
				.withIndex("by_locationId", (q) => q.eq("locationId", entry.id))
				.first();

			const data = {
				locationId: entry.id,
				name: entry.name,
				latitude: entry.lat,
				longitude: entry.lon,
				temp: entry.temp,
				humidity: entry.humidity,
				windSpeed: entry.windSpeed,
				windDeg: entry.windDeg,
				pressure: entry.pressure,
				visibility: entry.visibility,
				description: entry.description,
				icon: entry.icon,
				timestamp: now,
			};

			if (existing) {
				await ctx.db.patch(existing._id, data);
			} else {
				await ctx.db.insert("weatherData", data);
			}
		}
		return null;
	},
});
