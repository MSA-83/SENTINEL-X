import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

// ==================== CORE ====================
export function useAircraft() { return useQuery(api.entities.listAircraft) ?? []; }
export function useJammingAircraft() { return useQuery(api.entities.getJammingAircraft) ?? []; }
export function useConflictEvents() { return useQuery(api.entities.listConflictEvents) ?? []; }
export function useJammingAlerts() { return useQuery(api.entities.listJammingAlerts) ?? []; }
export function useActiveJammingAlerts() { return useQuery(api.entities.getActiveJammingAlerts) ?? []; }
export function useSatelliteScenes() { return useQuery(api.entities.listSatelliteScenes) ?? []; }
export function useSystemAlerts() { return useQuery(api.entities.listSystemAlerts) ?? []; }
export function usePlatformStats() {
	const stats = useQuery(api.entities.getStats) ?? [];
	const map = new Map<string, number>();
	for (const s of stats) map.set(s.key, s.value);
	return map;
}

// ==================== LIVE DATA ====================
export function useFires() { return useQuery(api.entities.listFires) ?? []; }
export function useVessels() { return useQuery(api.entities.listVessels) ?? []; }
export function useNewsItems() { return useQuery(api.entities.listNewsItems) ?? []; }
export function useCyberThreats() { return useQuery(api.entities.listCyberThreats) ?? []; }
export function useWeatherData() { return useQuery(api.entities.listWeatherData) ?? []; }
export function useSatellitePositions() { return useQuery(api.entities.listSatellitePositions) ?? []; }
export function useDataSourceStatus() { return useQuery(api.entities.listDataSourceStatus) ?? []; }

// ==================== PHASE 3 ====================
export function useSeismicEvents() { return useQuery(api.entities.listSeismicEvents) ?? []; }
export function useDisasters() { return useQuery(api.entities.listDisasters) ?? []; }
export function useSocialPosts() { return useQuery(api.entities.listSocialPosts) ?? []; }
export function useCyberIntel() { return useQuery(api.entities.listCyberIntel) ?? []; }
export function useGdeltEvents() { return useQuery(api.entities.listGdeltEvents) ?? []; }
export function useISSPositions() { return useQuery(api.entities.listISSPositions) ?? []; }
export function useThreatZones() { return useQuery(api.entities.listThreatZones) ?? []; }
export function useGlobalSearch(term: string) {
	return useQuery(api.entities.globalSearch, term.length >= 2 ? { term } : "skip") ?? [];
}
