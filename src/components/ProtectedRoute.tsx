import { useConvexAuth, useMutation } from "convex/react";
import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Shield } from "lucide-react";

function LoadingSkeleton() {
	return (
		<div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center">
			<div className="flex items-center gap-3 mb-6">
				<Shield className="w-8 h-8 text-emerald-400 animate-pulse" />
				<span className="text-2xl font-bold font-mono text-emerald-400 tracking-widest">SENTINEL-X</span>
			</div>
			<div className="flex items-center gap-2">
				<div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
				<div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
				<div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
			</div>
			<div className="text-[10px] font-mono text-slate-600 tracking-widest mt-4">INITIALIZING SECURE SESSION</div>
		</div>
	);
}

export function ProtectedRoute() {
	const { isAuthenticated, isLoading } = useConvexAuth();
	const triggerSeed = useMutation(api.seedTrigger.triggerSeed);

	// Trigger seed when authenticated
	useEffect(() => {
		if (isAuthenticated) {
			triggerSeed().catch(() => {});
		}
	}, [isAuthenticated, triggerSeed]);

	if (isLoading) {
		return <LoadingSkeleton />;
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" replace />;
	}

	return <Outlet />;
}
