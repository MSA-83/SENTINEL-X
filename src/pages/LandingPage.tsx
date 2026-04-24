import { useNavigate } from "react-router-dom";
import {
	Shield,
	Plane,
	Radio,
	Globe,
	Satellite,
	Zap,
	Lock,
	Activity,
	ChevronRight,
	AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
	{
		icon: <Plane className="w-5 h-5" />,
		title: "ADS-B Tracking",
		desc: "Real-time aircraft surveillance with GNSS interference detection across global airspace",
		color: "text-cyan-400",
		bg: "bg-cyan-950/30",
	},
	{
		icon: <Radio className="w-5 h-5" />,
		title: "GNSS Jamming Detection",
		desc: "Flink-powered anomaly detection correlating C/N₀ drops with H3 geospatial indexing",
		color: "text-red-400",
		bg: "bg-red-950/30",
	},
	{
		icon: <Globe className="w-5 h-5" />,
		title: "Conflict Intelligence",
		desc: "ACLED-integrated geopolitical event fusion with severity classification and trend analysis",
		color: "text-orange-400",
		bg: "bg-orange-950/30",
	},
	{
		icon: <Satellite className="w-5 h-5" />,
		title: "Satellite Imagery",
		desc: "Copernicus Sentinel-1/2 SAR and optical data integration for change detection",
		color: "text-blue-400",
		bg: "bg-blue-950/30",
	},
	{
		icon: <Zap className="w-5 h-5" />,
		title: "Stream Processing",
		desc: "Apache Flink with exactly-once semantics processing 1,200+ events/second in real-time",
		color: "text-emerald-400",
		bg: "bg-emerald-950/30",
	},
	{
		icon: <Lock className="w-5 h-5" />,
		title: "Zero-Trust Security",
		desc: "Keycloak OIDC + OPA ABAC policies with clearance-level data classification enforcement",
		color: "text-purple-400",
		bg: "bg-purple-950/30",
	},
];

const TECH_STACK = [
	"Apache Kafka", "Apache Flink", "PostGIS", "TimescaleDB",
	"FastAPI", "Deck.GL", "MapLibre GL", "Keycloak",
	"Kubernetes", "Prometheus", "TFX / PyTorch", "H3 Geospatial",
];

export function LandingPage() {
	const navigate = useNavigate();

	return (
		<div className="min-h-screen bg-slate-950 text-slate-200 overflow-x-hidden">
			{/* Hero */}
			<section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
				{/* Animated background grid */}
				<div className="absolute inset-0 opacity-[0.04]" style={{
					backgroundImage: `
						linear-gradient(rgba(34, 211, 238, 0.3) 1px, transparent 1px),
						linear-gradient(90deg, rgba(34, 211, 238, 0.3) 1px, transparent 1px)
					`,
					backgroundSize: "60px 60px",
				}} />

				{/* Radial glow */}
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-[128px]" />

				<div className="relative z-10 text-center px-4 max-w-5xl">
					<div className="flex items-center justify-center gap-3 mb-6">
						<Shield className="w-12 h-12 text-emerald-400" />
						<div className="text-left">
							<h1 className="text-5xl md:text-7xl font-black font-mono tracking-tighter text-emerald-400 leading-none">
								SENTINEL-X
							</h1>
							<div className="text-[10px] font-mono text-slate-600 tracking-[0.5em] uppercase">
								Global Situational Awareness Platform
							</div>
						</div>
					</div>

					<p className="text-lg md:text-xl text-slate-400 font-light max-w-2xl mx-auto mb-4 leading-relaxed">
						Multi-source intelligence fusion engine. Real-time threat detection.
						<br />
						<span className="text-slate-300 font-medium">Defense-grade awareness at the speed of data.</span>
					</p>

					<div className="flex items-center justify-center gap-3 text-[10px] font-mono text-slate-600 tracking-widest uppercase mb-10">
						<span className="flex items-center gap-1">
							<Activity className="w-3 h-3 text-emerald-500" /> 1,247 events/sec
						</span>
						<span className="text-slate-800">|</span>
						<span>6 data sources</span>
						<span className="text-slate-800">|</span>
						<span>Sub-second latency</span>
						<span className="text-slate-800">|</span>
						<span className="flex items-center gap-1">
							<AlertTriangle className="w-3 h-3 text-red-500 animate-pulse" /> 5 active alerts
						</span>
					</div>

					<div className="flex items-center justify-center gap-4">
						<Button
							size="lg"
							onClick={() => navigate("/login")}
							className="bg-emerald-600 hover:bg-emerald-500 text-black font-mono font-bold tracking-wider px-8 py-6 text-sm"
						>
							ACCESS COMMAND CENTER
							<ChevronRight className="w-4 h-4 ml-1" />
						</Button>
						<Button
							size="lg"
							variant="outline"
							onClick={() => navigate("/signup")}
							className="border-slate-700 text-slate-300 hover:bg-slate-800 font-mono tracking-wider px-8 py-6 text-sm"
						>
							REQUEST ACCESS
						</Button>
					</div>
				</div>
			</section>

			{/* Capabilities Grid */}
			<section className="py-24 px-4">
				<div className="max-w-6xl mx-auto">
					<div className="text-center mb-16">
						<div className="text-[10px] font-mono text-emerald-500 tracking-[0.5em] uppercase mb-2">CAPABILITIES</div>
						<h2 className="text-3xl font-bold font-mono text-slate-200 tracking-tight">Intelligence Fusion Stack</h2>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{FEATURES.map((f) => (
							<div
								key={f.title}
								className={`${f.bg} border border-slate-800/40 rounded-lg p-5 hover:border-slate-700/60 transition-all group`}
							>
								<div className={`${f.color} mb-3 group-hover:scale-110 transition-transform`}>{f.icon}</div>
								<h3 className="text-sm font-mono font-bold text-slate-200 mb-2">{f.title}</h3>
								<p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Architecture */}
			<section className="py-20 px-4 bg-slate-900/30 border-y border-slate-800/40">
				<div className="max-w-5xl mx-auto">
					<div className="text-center mb-12">
						<div className="text-[10px] font-mono text-cyan-500 tracking-[0.5em] uppercase mb-2">ARCHITECTURE</div>
						<h2 className="text-2xl font-bold font-mono text-slate-200 tracking-tight">Production-Grade Stack</h2>
					</div>

					<div className="flex flex-wrap justify-center gap-2">
						{TECH_STACK.map((tech) => (
							<span
								key={tech}
								className="px-3 py-1.5 bg-slate-900/60 border border-slate-700/40 rounded-md text-xs font-mono text-slate-400 hover:text-cyan-400 hover:border-cyan-800/40 transition-all"
							>
								{tech}
							</span>
						))}
					</div>

					{/* Data flow diagram */}
					<div className="mt-12 p-6 bg-slate-950/60 border border-slate-800/40 rounded-lg">
						<div className="text-[10px] font-mono text-slate-600 mb-3 tracking-wider">DATA FLOW</div>
						<pre className="text-[10px] md:text-xs font-mono text-slate-500 leading-relaxed overflow-x-auto">
{`┌─────────────────┐    ┌──────────┐    ┌───────────────┐    ┌──────────────┐    ┌─────────────────┐
│  DATA SOURCES   │───▶│  KAFKA   │───▶│  FLINK JOBS   │───▶│  PostGIS +   │───▶│  SENTINEL-X     │
│                 │    │  TOPICS  │    │               │    │  TimescaleDB │    │  COMMAND CENTER │
│ • OpenSky ADS-B │    │          │    │ • GNSS Detect │    │              │    │                 │
│ • ACLED Events  │    │ raw.*    │    │ • Geo Enrich  │    │ • GiST Index │    │ • MapLibre GL   │
│ • Copernicus    │    │ alerts.* │    │ • Anomaly ML  │    │ • Hypertable │    │ • Deck.GL       │
│ • GNSS-SDR      │    │ fused.*  │    │ • Fusion      │    │ • Redis      │    │ • WebSocket     │
│ • Twitter v2    │    │          │    │               │    │              │    │ • React 18      │
│ • GDELT         │    │          │    │               │    │              │    │                 │
└─────────────────┘    └──────────┘    └───────────────┘    └──────────────┘    └─────────────────┘
                              │                │                    │
                              ▼                ▼                    ▼
                     ┌──────────────────────────────────────────────────────┐
                     │              KEYCLOAK + OPA SECURITY MESH            │
                     │    OAuth2/OIDC • RBAC/ABAC • Data Classification    │
                     └──────────────────────────────────────────────────────┘`}
						</pre>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="py-8 px-4 text-center">
				<div className="flex items-center justify-center gap-2 mb-2">
					<Shield className="w-4 h-4 text-emerald-600" />
					<span className="text-xs font-mono text-slate-600">SENTINEL-X</span>
				</div>
				<div className="text-[9px] font-mono text-slate-700 tracking-wider">
					UNCLASSIFIED // FOR OFFICIAL USE ONLY // DEMO INSTANCE
				</div>
			</footer>
		</div>
	);
}
