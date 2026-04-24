import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicLayout } from "./components/PublicLayout";
import { PublicOnlyRoute } from "./components/PublicOnlyRoute";
import { Toaster } from "./components/ui/sonner";
import { ThemeProvider } from "./contexts/ThemeContext";

// Lazy-loaded pages — split heavy dashboard from lightweight auth/landing
const LandingPage = lazy(() => import("./pages/LandingPage").then((m) => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import("./pages/SignupPage").then((m) => ({ default: m.SignupPage })));
const CommandCenter = lazy(() => import("./pages/CommandCenter").then((m) => ({ default: m.CommandCenter })));
const CaseManagementPage = lazy(() => import("./pages/CaseManagementPage").then((m) => ({ default: m.CaseManagementPage })));
const KnowledgeGraphPage = lazy(() => import("./pages/KnowledgeGraphPage").then((m) => ({ default: m.KnowledgeGraphPage })));
const AdminConsolePage = lazy(() => import("./pages/AdminConsolePage").then((m) => ({ default: m.AdminConsolePage })));
const ExecutiveSummaryPage = lazy(() => import("./pages/ExecutiveSummaryPage").then((m) => ({ default: m.ExecutiveSummaryPage })));
const AICopilotPage = lazy(() => import("./pages/AICopilotPage").then((m) => ({ default: m.AICopilotPage })));
const AssetTrackingPage = lazy(() => import("./pages/AssetTrackingPage").then((m) => ({ default: m.AssetTrackingPage })));
const WorkspaceManagerPage = lazy(() => import("./pages/WorkspaceManagerPage").then((m) => ({ default: m.WorkspaceManagerPage })));

function LoadingFallback() {
	return (
		<div className="min-h-screen bg-slate-950 flex items-center justify-center">
			<div className="text-center space-y-4">
				<div className="relative w-16 h-16 mx-auto">
					<div className="absolute inset-0 border-2 border-cyan-500/30 rounded-full animate-ping" />
					<div className="absolute inset-2 border-2 border-cyan-400/60 rounded-full animate-pulse" />
					<div className="absolute inset-4 bg-cyan-500/20 rounded-full" />
				</div>
				<div className="text-xs font-mono text-slate-500 tracking-widest">SENTINEL-X LOADING</div>
			</div>
		</div>
	);
}

function App() {
	return (
		<ErrorBoundary>
			<ThemeProvider defaultTheme="dark" switchable={false}>
				<Toaster />
				<Suspense fallback={<LoadingFallback />}>
					<Routes>
						<Route element={<PublicLayout />}>
							<Route path="/" element={<LandingPage />} />
							<Route element={<PublicOnlyRoute />}>
								<Route path="/login" element={<LoginPage />} />
								<Route path="/signup" element={<SignupPage />} />
							</Route>
						</Route>

						<Route element={<ProtectedRoute />}>
							<Route path="/dashboard" element={<CommandCenter />} />
							<Route path="/cases" element={<CaseManagementPage />} />
							<Route path="/knowledge-graph" element={<KnowledgeGraphPage />} />
							<Route path="/admin" element={<AdminConsolePage />} />
							<Route path="/executive" element={<ExecutiveSummaryPage />} />
							<Route path="/copilot" element={<AICopilotPage />} />
							<Route path="/assets" element={<AssetTrackingPage />} />
							<Route path="/workspaces" element={<WorkspaceManagerPage />} />
						</Route>

						<Route path="*" element={<Navigate to="/" replace />} />
					</Routes>
				</Suspense>
			</ThemeProvider>
		</ErrorBoundary>
	);
}

export default App;
