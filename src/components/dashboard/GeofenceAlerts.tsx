/**
 * GeofenceAlerts — Monitors entity positions against drawn geofence zones.
 * When an entity enters/exits a zone, generates a toast notification.
 * Uses ray-casting point-in-polygon for detection.
 */
import { useEffect, useRef, useCallback } from "react";

export interface GeofenceZone {
	id: string;
	name: string;
	points: [number, number][]; // [lng, lat]
	active: boolean;
	alertOnEntry: boolean;
}

export interface GeofenceAlert {
	id: string;
	type: "ENTER" | "EXIT";
	zoneName: string;
	entityType: string;
	entityLabel: string;
	lat: number;
	lng: number;
	timestamp: number;
}

interface GeoEntity {
	latitude?: number;
	longitude?: number;
	lat?: number;
	lon?: number;
	lng?: number;
	callsign?: string;
	icao24?: string;
	mmsi?: string;
	name?: string;
	title?: string;
	eventId?: string;
	_entityType?: string;
}

interface GeofenceAlertsProps {
	zones: GeofenceZone[];
	entities: GeoEntity[];
	onAlert: (alert: GeofenceAlert) => void;
	enabled: boolean;
}

/** Ray-casting point-in-polygon test */
function pointInPolygon(lng: number, lat: number, polygon: [number, number][]): boolean {
	let inside = false;
	const n = polygon.length;
	for (let i = 0, j = n - 1; i < n; j = i++) {
		const xi = polygon[i][0],
			yi = polygon[i][1];
		const xj = polygon[j][0],
			yj = polygon[j][1];
		const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}

function getEntityCoords(e: GeoEntity): { lat: number; lng: number } | null {
	const lat = e.latitude ?? e.lat;
	const lng = e.longitude ?? e.lon ?? e.lng;
	if (lat == null || lng == null) return null;
	return { lat: lat as number, lng: lng as number };
}

function getEntityId(e: GeoEntity): string {
	return (e.icao24 || e.mmsi || e.eventId || e.callsign || e.title || "unk") as string;
}

function getEntityLabel(e: GeoEntity): string {
	return (e.callsign || e.name || e.title || e.icao24 || e.mmsi || "Unknown") as string;
}

function getEntityType(e: GeoEntity): string {
	if (e._entityType) return e._entityType as string;
	if (e.icao24) return "aircraft";
	if (e.mmsi) return "vessel";
	return "entity";
}

export default function GeofenceAlerts({ zones, entities, onAlert, enabled }: GeofenceAlertsProps) {
	// Track which entities are inside which zones: Map<zoneId, Set<entityId>>
	const insideMapRef = useRef<Map<string, Set<string>>>(new Map());

	const checkEntities = useCallback(() => {
		if (!enabled) return;

		const activeZones = zones.filter((z) => z.active && z.alertOnEntry && z.points.length >= 3);
		if (activeZones.length === 0) return;

		for (const zone of activeZones) {
			const prevInside = insideMapRef.current.get(zone.id) ?? new Set();
			const currentInside = new Set<string>();

			for (const entity of entities) {
				const coords = getEntityCoords(entity);
				if (!coords) continue;

				const entityId = getEntityId(entity);
				const isIn = pointInPolygon(coords.lng, coords.lat, zone.points);

				if (isIn) {
					currentInside.add(entityId);

					// Newly entered
					if (!prevInside.has(entityId)) {
						onAlert({
							id: `${zone.id}-${entityId}-${Date.now()}`,
							type: "ENTER",
							zoneName: zone.name,
							entityType: getEntityType(entity),
							entityLabel: getEntityLabel(entity),
							lat: coords.lat,
							lng: coords.lng,
							timestamp: Date.now(),
						});
					}
				} else {
					// Previously inside, now outside — EXIT
					if (prevInside.has(entityId)) {
						onAlert({
							id: `${zone.id}-${entityId}-${Date.now()}`,
							type: "EXIT",
							zoneName: zone.name,
							entityType: getEntityType(entity),
							entityLabel: getEntityLabel(entity),
							lat: coords.lat,
							lng: coords.lng,
							timestamp: Date.now(),
						});
					}
				}
			}

			insideMapRef.current.set(zone.id, currentInside);
		}
	}, [zones, entities, onAlert, enabled]);

	// Run check every 10 seconds
	useEffect(() => {
		if (!enabled) return;

		// Initial check
		checkEntities();

		const interval = setInterval(checkEntities, 10_000);
		return () => clearInterval(interval);
	}, [enabled, checkEntities]);

	return null; // Logic-only component
}
