import { Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { useConvexAuth } from "convex/react";

export default function Header() {
	const { isAuthenticated } = useConvexAuth();
	const navigate = useNavigate();

	return (
		<header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/40">
			<div className="flex items-center justify-between px-6 py-3 max-w-7xl mx-auto">
				<Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
					<Shield className="w-5 h-5 text-emerald-400" />
					<span className="text-sm font-bold font-mono text-emerald-400 tracking-widest">SENTINEL-X</span>
				</Link>

				<div className="flex items-center gap-3">
					{isAuthenticated ? (
						<Button
							size="sm"
							onClick={() => navigate("/dashboard")}
							className="bg-emerald-600 hover:bg-emerald-500 text-black font-mono text-xs tracking-wider"
						>
							COMMAND CENTER
						</Button>
					) : (
						<>
							<Button
								size="sm"
								variant="ghost"
								onClick={() => navigate("/login")}
								className="text-slate-400 font-mono text-xs tracking-wider hover:text-slate-200"
							>
								SIGN IN
							</Button>
							<Button
								size="sm"
								onClick={() => navigate("/signup")}
								className="bg-emerald-600 hover:bg-emerald-500 text-black font-mono text-xs tracking-wider"
							>
								REQUEST ACCESS
							</Button>
						</>
					)}
				</div>
			</div>
		</header>
	);
}
