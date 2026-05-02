import { Hono } from "hono";
import { FusionEngine } from "../fusion/engine";
import { normalizeADSB, normalizeAIS } from "../fusion/normalize";
import { calculateRisk } from "../fusion/risk";

const fusion = new Hono();
const engine = new FusionEngine();

fusion.get("/snapshot", (c) => {
  // simulate ingestion
  const adsb = normalizeADSB([
    { id: "FLIGHT-1", lat: 52.37, lon: 4.89, altitude: 900 },
  ]);

  const ais = normalizeAIS([
    { id: "VESSEL-1", lat: 51.9, lon: 4.4, speed: 35 },
  ]);

  engine.ingest([...adsb, ...ais]);
  engine.prune();

  const snapshot = engine.getSnapshot().map(calculateRisk);

  return c.json({
    count: snapshot.length,
    data: snapshot,
  });
});

export default fusion;
