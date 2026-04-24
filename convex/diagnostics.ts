import { query } from "./_generated/server";

// Diagnostic query to check which environment variables are set
export const checkEnvKeys = query({
  args: {},
  handler: async () => {
    const keys = [
      "NASA_FIRMS_KEY", "N2YO_KEY", "OPENWEATHER_KEY", "NEWSAPI_KEY",
      "SHODAN_KEY", "RAPIDAPI_KEY", "GFW_TOKEN", "AVWX_TOKEN",
      "ABUSECH_KEY", "AISSTREAM_KEY", "COPERNICUS_CLIENT_ID",
      "COPERNICUS_CLIENT_SECRET", "SPACETRACK_USER", "SPACETRACK_PASS",
      "CESIUM_TOKEN", "PLANET_API_KEY",
    ];
    const result: Record<string, boolean> = {};
    for (const k of keys) {
      result[k] = !!process.env[k];
    }
    return result;
  },
});
