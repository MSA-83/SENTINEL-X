import { useNewsItems } from "../../hooks/useEntityData";
import { Newspaper, ExternalLink } from "lucide-react";

interface NewsFeedProps {
	onFlyTo?: (lat: number, lon: number) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
	conflict: "text-orange-400 bg-orange-950/30 border-orange-800/30",
	gnss: "text-red-400 bg-red-950/30 border-red-800/30",
	cyber: "text-purple-400 bg-purple-950/30 border-purple-800/30",
	kinetic: "text-red-400 bg-red-950/30 border-red-800/30",
	default: "text-emerald-400 bg-emerald-950/30 border-emerald-800/30",
};

export function NewsFeed({ onFlyTo }: NewsFeedProps) {
	const news = useNewsItems();

	return (
		<div className="flex flex-col h-full bg-slate-950/90 border-t border-slate-800/60">
			<div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800/60">
				<Newspaper className="w-3 h-3 text-emerald-400" />
				<span className="text-[10px] font-mono font-bold text-slate-400 tracking-widest">
					OSINT FEED
				</span>
				<span className="ml-auto text-[10px] font-mono text-slate-600">{news.length} items</span>
			</div>
			<div className="flex-1 overflow-y-auto space-y-1 p-1.5">
				{news.length === 0 ? (
					<div className="p-3 text-center text-[10px] font-mono text-slate-600">
						Awaiting OSINT feed...
					</div>
				) : (
					news.slice(0, 50).map((item) => {
						const catColors = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.default;
						return (
							<div
								key={item._id}
								className="px-2 py-1.5 rounded bg-slate-900/40 border border-slate-800/30 hover:bg-slate-800/40 transition-colors cursor-pointer group"
								onClick={() => {
									if (item.latitude && item.longitude) {
										onFlyTo?.(item.latitude, item.longitude);
									}
								}}
							>
								<div className="flex items-start gap-1.5">
									<span className={`text-[8px] font-mono font-bold uppercase tracking-wider px-1 py-0.5 rounded border shrink-0 mt-0.5 ${catColors}`}>
										{item.category}
									</span>
									<div className="min-w-0 flex-1">
										<div className="text-[10px] font-mono text-slate-300 leading-tight line-clamp-2 group-hover:text-white transition-colors">
											{item.title}
										</div>
										<div className="flex items-center gap-2 mt-0.5">
											<span className="text-[8px] font-mono text-slate-600">
												{item.sourceName}
											</span>
											{item.url && (
												<a
													href={item.url}
													target="_blank"
													rel="noopener noreferrer"
													onClick={(e) => e.stopPropagation()}
													className="text-slate-600 hover:text-slate-400"
												>
													<ExternalLink className="w-2.5 h-2.5" />
												</a>
											)}
										</div>
									</div>
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
