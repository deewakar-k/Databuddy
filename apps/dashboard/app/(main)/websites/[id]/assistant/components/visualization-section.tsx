'use client';

import {
	ChartBar,
	ChartLine,
	ChartPie,
	Compass, // for radar
	Database,
	DotsThreeOutlineVertical, // for scatter
	Funnel,
	TrendUp,
} from '@phosphor-icons/react';
import type { ColumnDef } from '@tanstack/react-table';
import { useAtom } from 'jotai';
import { useMemo } from 'react';
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	FunnelChart,
	Legend,
	Line,
	LineChart,
	Pie,
	PieChart,
	PolarAngleAxis,
	PolarGrid,
	RadarChart,
	Funnel as RechartsFunnel,
	Radar as RechartsRadar,
	ResponsiveContainer,
	Scatter,
	ScatterChart,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { DataTable } from '@/components/analytics/data-table';
import { Badge } from '@/components/ui/badge';
import {
	ChartContainer,
	ChartLegendContent,
	ChartTooltipContent,
} from '@/components/ui/chart';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
	currentMessageAtom,
	dateRangeAtom,
	messagesAtom,
	websiteDataAtom,
	websiteIdAtom,
} from '@/stores/jotai/assistantAtoms';
import type { Message } from '../types/message';

const CHART_COLORS = ['#2563eb', '#f97316', '#22c55e', '#ef4444', '#8b5cf6'];

const getChartIcon = (chartType: string) => {
	switch (chartType?.toLowerCase()) {
		case 'bar':
			return <ChartBar className="h-3 w-3" />;
		case 'line':
		case 'area': // No ChartArea, use ChartLine
			return <ChartLine className="h-3 w-3" />;
		case 'pie':
			return <ChartPie className="h-3 w-3" />;
		case 'stacked_bar':
		case 'grouped_bar':
			return <ChartBar className="h-3 w-3" />;
		case 'multi_line':
			return <ChartLine className="h-3 w-3" />;
		case 'scatter':
			return <DotsThreeOutlineVertical className="h-3 w-3" />;
		case 'radar':
			return <Compass className="h-3 w-3" />;
		case 'funnel':
			return <Funnel className="h-3 w-3" />;
		default:
			return <ChartBar className="h-3 w-3" />;
	}
};

export function VisualizationSkeleton() {
	return (
		<div className="flex h-full flex-col overflow-hidden rounded border bg-background shadow-sm">
			<div className="flex flex-shrink-0 items-center gap-3 border-b bg-muted/30 p-3">
				<Skeleton className="h-8 w-8 rounded" />
				<div className="flex-1">
					<Skeleton className="mb-1 h-5 w-32" />
				</div>
				<Skeleton className="h-6 w-24 rounded-md" />
			</div>
			<div className="flex-1 space-y-4 overflow-y-auto p-3">
				<Skeleton className="h-56 w-full rounded-lg" />
				<div>
					<Skeleton className="mb-2 h-4 w-1/4" />
					<Skeleton className="h-32 w-full rounded-lg" />
				</div>
			</div>
			<div className="flex-shrink-0 border-t bg-muted/20 p-3">
				<Skeleton className="mb-1.5 h-4 w-24" />
				<div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
					<Skeleton className="h-7 w-full rounded" />
					<Skeleton className="h-7 w-full rounded" />
				</div>
			</div>
		</div>
	);
}

interface TransformResult {
	chartData: ChartDataItem[];
	xAxisKey: string;
}

interface ChartConfig {
	[key: string]: {
		label: string;
		color?: string;
	};
}

interface ChartDataItem {
	[key: string]: string | number | null | undefined;
}

export default function VisualizationSection() {
	const [websiteData] = useAtom(websiteDataAtom);
	const [messages] = useAtom(messagesAtom);

	// Find the latest assistant message with a chartType
	const latestAssistantMsg = useMemo(() => {
		return [...messages]
			.reverse()
			.find((msg: Message) => msg.type === 'assistant' && msg.chartType);
	}, [messages]);

	const rawAiData = useMemo(() => {
		if (!latestAssistantMsg?.data || latestAssistantMsg.data.length === 0) {
			return [];
		}

		// Validate that data is an array and has valid structure
		const data = latestAssistantMsg.data;
		if (!Array.isArray(data) || data.length === 0) {
			return [];
		}

		// Ensure each item is an object
		const validData = data.filter(
			(item) => item && typeof item === 'object' && !Array.isArray(item)
		);

		return validData;
	}, [latestAssistantMsg]);

	const chartDisplayConfig = useMemo(() => {
		if (!rawAiData || rawAiData.length === 0) {
			return { chartDataForDisplay: [], finalXAxisKey: 'date' };
		}
		const chartType = latestAssistantMsg?.chartType;

		// For bar charts, use the raw data directly if it's already in the right format
		if (chartType === 'bar' && rawAiData.length > 0) {
			const firstRow = rawAiData[0];
			const keys = Object.keys(firstRow);

			// Find the categorical key (string) and metric key (number)
			const categoryKey =
				keys.find((k) => typeof firstRow[k] === 'string') || keys[0];
			const metricKey =
				keys.find((k) => typeof firstRow[k] === 'number') || keys[1];

			if (categoryKey && metricKey) {
				// Create properly formatted data for the chart
				const formattedData = rawAiData.map((item) => ({
					[categoryKey]: String(item[categoryKey]),
					[metricKey]: Number(item[metricKey]) || 0,
				}));

				// Sort by the metric value in descending order
				formattedData.sort(
					(a, b) => (Number(b[metricKey]) || 0) - (Number(a[metricKey]) || 0)
				);

				const MAX_CHART_ITEMS = 10; // Show up to 10 items for "Top 10" queries
				const finalData = formattedData.slice(0, MAX_CHART_ITEMS);

				return {
					chartDataForDisplay: finalData,
					finalXAxisKey: categoryKey,
					metricKey,
				};
			}
		}

		// Fall back to the original transformation for other chart types
		const { chartData: transformedDataFromFunc, xAxisKey: xAxisKeyFromFunc } =
			transformDataForMetricsChart(rawAiData, chartType);

		let workingData = transformedDataFromFunc;

		if (
			chartType === 'bar' &&
			xAxisKeyFromFunc === 'date' &&
			workingData.length > 0 &&
			workingData[0]
		) {
			const metricKeyForAggregation =
				'pageviews' in workingData[0]
					? 'pageviews'
					: Object.keys(workingData[0]).find(
							(k) =>
								typeof workingData[0][k] === 'number' && k !== xAxisKeyFromFunc
						);

			if (metricKeyForAggregation) {
				const aggregatedMap = new Map<string, number>();
				for (const item of workingData) {
					const displayName = String(item[xAxisKeyFromFunc]);
					const metricValue = Number(item[metricKeyForAggregation]) || 0;
					aggregatedMap.set(
						displayName,
						(aggregatedMap.get(displayName) || 0) + metricValue
					);
				}
				workingData = Array.from(aggregatedMap, ([name, value]) => ({
					[xAxisKeyFromFunc]: name,
					[metricKeyForAggregation]: value,
				}));
			}
		}

		let finalChartData = workingData;
		const MAX_CHART_ITEMS = 7;

		if (
			(chartType === 'bar' || chartType === 'pie') &&
			workingData.length > MAX_CHART_ITEMS
		) {
			const primaryMetricKeyForSorting =
				workingData[0] && 'pageviews' in workingData[0]
					? 'pageviews'
					: workingData[0]
						? Object.keys(workingData[0]).find(
								(k) =>
									typeof workingData[0][k] === 'number' &&
									k !== xAxisKeyFromFunc
							)
						: undefined;

			if (primaryMetricKeyForSorting) {
				const sortableData = [...workingData];
				sortableData.sort(
					(a, b) =>
						(Number(b[primaryMetricKeyForSorting]) || 0) -
						(Number(a[primaryMetricKeyForSorting]) || 0)
				);
				finalChartData = sortableData.slice(0, MAX_CHART_ITEMS);
			} else {
				finalChartData = workingData.slice(0, MAX_CHART_ITEMS);
			}
		}
		return {
			chartDataForDisplay: finalChartData,
			finalXAxisKey: xAxisKeyFromFunc,
		};
	}, [rawAiData, latestAssistantMsg?.chartType]);

	const chartConfig = useMemo((): ChartConfig => {
		if (
			!chartDisplayConfig.chartDataForDisplay ||
			chartDisplayConfig.chartDataForDisplay.length === 0 ||
			!chartDisplayConfig.chartDataForDisplay[0]
		) {
			return {};
		}
		const data = chartDisplayConfig.chartDataForDisplay;
		const xAxisKey = chartDisplayConfig.finalXAxisKey;
		const keys = Object.keys(data[0] || {}).filter((key) => key !== xAxisKey);
		const config: ChartConfig = {
			[xAxisKey]: {
				label: xAxisKey
					.replace(/_/g, ' ')
					.replace(/\b\w/g, (l) => l.toUpperCase()),
			},
		};
		keys.forEach((key, index) => {
			config[key] = {
				label: key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
				color: CHART_COLORS[index % CHART_COLORS.length],
			};
		});
		return config;
	}, [chartDisplayConfig]);

	const columnsForTable = useMemo(() => {
		if (!rawAiData || rawAiData.length === 0) {
			return [];
		}
		return generateColumns(rawAiData);
	}, [rawAiData]);

	const renderBarChart = (
		data: ChartDataItem[],
		xAxisKey: string,
		availableMetricKeys: string[],
		chartConfig: ChartConfig
	) => (
		<BarChart data={data}>
			<CartesianGrid vertical={false} />
			<XAxis
				axisLine={false}
				dataKey={xAxisKey}
				tickLine={false}
				tickMargin={8}
			/>
			<YAxis />
			<Tooltip
				content={<ChartTooltipContent indicator="dot" />}
				cursor={false}
			/>
			<Bar
				dataKey={availableMetricKeys[0]}
				fill={chartConfig[availableMetricKeys[0]]?.color || CHART_COLORS[0]}
				radius={4}
			/>
		</BarChart>
	);

	const renderLineChart = (
		data: ChartDataItem[],
		xAxisKey: string,
		availableMetricKeys: string[],
		chartConfig: ChartConfig
	) => (
		<LineChart data={data}>
			<CartesianGrid vertical={false} />
			<XAxis
				axisLine={false}
				dataKey={xAxisKey}
				tickLine={false}
				tickMargin={8}
			/>
			<YAxis />
			<Tooltip
				content={<ChartTooltipContent indicator="dot" />}
				cursor={false}
			/>
			<Legend content={<ChartLegendContent />} />
			{availableMetricKeys.map((key) => (
				<Line
					dataKey={key}
					dot={false}
					key={key}
					stroke={chartConfig[key]?.color}
					strokeWidth={2}
				/>
			))}
		</LineChart>
	);

	const renderAreaChart = (
		data: ChartDataItem[],
		xAxisKey: string,
		availableMetricKeys: string[],
		chartConfig: ChartConfig
	) => (
		<AreaChart data={data}>
			<CartesianGrid vertical={false} />
			<XAxis
				axisLine={false}
				dataKey={xAxisKey}
				tickLine={false}
				tickMargin={8}
			/>
			<YAxis />
			<Tooltip
				content={<ChartTooltipContent indicator="dot" />}
				cursor={false}
			/>
			<Legend content={<ChartLegendContent />} />
			{availableMetricKeys.map((key) => (
				<Area
					dataKey={key}
					fill={chartConfig[key]?.color}
					key={key}
					stackId="a"
					stroke={chartConfig[key]?.color}
					type="natural"
				/>
			))}
		</AreaChart>
	);

	const renderPieChart = (
		data: ChartDataItem[],
		xAxisKey: string,
		availableMetricKeys: string[]
	) => {
		if (availableMetricKeys.length === 0) {
			return (
				<div className="flex h-full items-center justify-center text-muted-foreground">
					<p>No valid data for pie chart</p>
				</div>
			);
		}
		const COLORS = data.map(
			(_entry, index) => CHART_COLORS[index % CHART_COLORS.length]
		);
		return (
			<PieChart>
				<Tooltip
					content={<ChartTooltipContent indicator="dot" />}
					cursor={false}
				/>
				<Pie
					data={data}
					dataKey={availableMetricKeys[0]}
					innerRadius={60}
					nameKey={xAxisKey}
					strokeWidth={5}
				>
					{data.map((entry, index) => (
						<Cell
							fill={COLORS[index % COLORS.length]}
							key={`cell-${entry[xAxisKey]}`}
						/>
					))}
				</Pie>
				<Legend content={<ChartLegendContent />} />
			</PieChart>
		);
	};

	const renderMultiLineChart = (
		data: ChartDataItem[],
		xAxisKey: string,
		availableMetricKeys: string[],
		chartConfig: ChartConfig
	) => (
		<LineChart data={data}>
			<CartesianGrid vertical={false} />
			<XAxis
				axisLine={false}
				dataKey={xAxisKey}
				tickLine={false}
				tickMargin={8}
			/>
			<YAxis />
			<Tooltip
				content={<ChartTooltipContent indicator="dot" />}
				cursor={false}
			/>
			<Legend content={<ChartLegendContent />} />
			{availableMetricKeys.map((key) => (
				<Line
					dataKey={key}
					dot={false}
					key={key}
					stroke={chartConfig[key]?.color}
					strokeWidth={2}
				/>
			))}
		</LineChart>
	);

	const renderStackedBarChart = (
		data: ChartDataItem[],
		xAxisKey: string,
		availableMetricKeys: string[],
		chartConfig: ChartConfig
	) => (
		<BarChart data={data} layout="vertical">
			<CartesianGrid horizontal={false} />
			<XAxis type="number" />
			<YAxis
				axisLine={false}
				dataKey={xAxisKey}
				tickLine={false}
				tickMargin={8}
				type="category"
			/>
			<Tooltip
				content={<ChartTooltipContent indicator="dot" />}
				cursor={false}
			/>
			<Legend content={<ChartLegendContent />} />
			{availableMetricKeys.map((key) => (
				<Bar
					dataKey={key}
					fill={chartConfig[key]?.color}
					key={key}
					radius={4}
					stackId="a"
				/>
			))}
		</BarChart>
	);

	const renderGroupedBarChart = (
		data: ChartDataItem[],
		xAxisKey: string,
		availableMetricKeys: string[]
	) => (
		<BarChart data={data}>
			<CartesianGrid vertical={false} />
			<XAxis
				axisLine={false}
				dataKey={xAxisKey}
				tickLine={false}
				tickMargin={8}
			/>
			<YAxis />
			<Tooltip
				content={<ChartTooltipContent indicator="dot" />}
				cursor={false}
			/>
			<Legend content={<ChartLegendContent />} />
			{availableMetricKeys.map((key, index) => (
				<Bar
					dataKey={key}
					fill={CHART_COLORS[index % CHART_COLORS.length]}
					key={key}
					radius={4}
				/>
			))}
		</BarChart>
	);

	const renderScatterChart = (
		data: ChartDataItem[],
		availableMetricKeys: string[]
	) => {
		if (availableMetricKeys.length < 2) {
			return (
				<div className="flex h-full items-center justify-center text-muted-foreground">
					<p>Scatter chart requires at least 2 numeric columns</p>
				</div>
			);
		}
		return (
			<ScatterChart>
				<CartesianGrid />
				<XAxis
					dataKey={availableMetricKeys[0]}
					name={availableMetricKeys[0]}
					type="number"
				/>
				<YAxis
					dataKey={availableMetricKeys[1]}
					name={availableMetricKeys[1]}
					type="number"
				/>
				<Tooltip
					content={<ChartTooltipContent hideLabel />}
					cursor={{ strokeDasharray: '3 3' }}
				/>
				<Scatter data={data} fill={CHART_COLORS[0]} />
			</ScatterChart>
		);
	};

	const renderRadarChart = (
		data: ChartDataItem[],
		xAxisKey: string,
		availableMetricKeys: string[],
		chartConfig: ChartConfig
	) => (
		<RadarChart data={data}>
			<PolarGrid />
			<PolarAngleAxis dataKey={xAxisKey} />
			<Tooltip content={<ChartTooltipContent />} />
			<Legend content={<ChartLegendContent />} />
			{availableMetricKeys.map((key) => (
				<RechartsRadar
					dataKey={key}
					fill={chartConfig[key]?.color}
					fillOpacity={0.6}
					key={key}
					name={key}
					stroke={chartConfig[key]?.color}
				/>
			))}
		</RadarChart>
	);

	const renderFunnelChart = (
		data: ChartDataItem[],
		xAxisKey: string,
		availableMetricKeys: string[]
	) => (
		<FunnelChart>
			<Tooltip />
			<RechartsFunnel
				data={data}
				dataKey={availableMetricKeys[0] || 'users'}
				isAnimationActive
			>
				{data.map((entry, index) => (
					<Cell
						fill={CHART_COLORS[index % CHART_COLORS.length]}
						key={`cell-${entry[xAxisKey] || index}`}
					/>
				))}
			</RechartsFunnel>
		</FunnelChart>
	);

	const renderChartContent = () => {
		if (
			!(websiteData && rawAiData) ||
			rawAiData.length === 0 ||
			!latestAssistantMsg?.chartType
		) {
			return (
				<div
					className={`flex h-full min-h-[200px] flex-col items-center justify-center py-6 text-center text-muted-foreground transition-all duration-300 ${websiteData ? 'animate-pulse' : 'fade-in-0 slide-in-from-bottom-2 animate-in'}`}
				>
					<div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-muted transition-all duration-300">
						<Database className="h-6 w-6 opacity-50" />
					</div>
					<h3 className="mb-1 font-medium text-sm transition-all duration-300">
						{websiteData
							? 'Loading Visualization...'
							: 'No Visualization Available'}
					</h3>
					<p className="max-w-xs px-4 text-xs transition-all duration-300">
						{websiteData
							? 'Processing your data query...'
							: 'Ask a question that needs a chart or table to see your data visualized here. For single metrics or general questions, check the chat area.'}
					</p>
				</div>
			);
		}

		const { chartType: aiChartType } = latestAssistantMsg;
		const showMetricsChart = [
			'line',
			'bar',
			'area',
			'multi_line',
			'stacked_bar',
			'grouped_bar',
			'pie',
			'scatter',
			'radar',
			'funnel',
		].includes(aiChartType?.toLowerCase() || '');

		const metricKeys = Object.keys(chartConfig).filter(
			(key) => key !== chartDisplayConfig.finalXAxisKey
		);

		const renderChart = () => {
			if (
				!chartDisplayConfig.chartDataForDisplay ||
				chartDisplayConfig.chartDataForDisplay.length === 0
			) {
				return (
					<div className="flex h-full items-center justify-center text-muted-foreground">
						<p>No data available for visualization</p>
					</div>
				);
			}

			const data = chartDisplayConfig.chartDataForDisplay;
			const xAxisKey = chartDisplayConfig.finalXAxisKey;
			const availableMetricKeys = metricKeys.filter((key) =>
				data.some((item) => item[key] !== null && item[key] !== undefined)
			);

			if (availableMetricKeys.length === 0) {
				return (
					<div className="flex h-full items-center justify-center text-muted-foreground">
						<p>No valid metric data found</p>
					</div>
				);
			}

			// Additional validation for specific chart types
			if (
				aiChartType?.toLowerCase() === 'scatter' &&
				availableMetricKeys.length < 2
			) {
				return (
					<div className="flex h-full items-center justify-center text-muted-foreground">
						<p>Scatter chart requires at least 2 numeric columns</p>
					</div>
				);
			}

			if (
				aiChartType?.toLowerCase() === 'pie' &&
				availableMetricKeys.length === 0
			) {
				return (
					<div className="flex h-full items-center justify-center text-muted-foreground">
						<p>Pie chart requires at least one numeric column</p>
					</div>
				);
			}

			switch (aiChartType?.toLowerCase()) {
				case 'bar':
					return renderBarChart(
						data,
						xAxisKey,
						availableMetricKeys,
						chartConfig
					);
				case 'line':
					return renderLineChart(
						data,
						xAxisKey,
						availableMetricKeys,
						chartConfig
					);
				case 'area':
					return renderAreaChart(
						data,
						xAxisKey,
						availableMetricKeys,
						chartConfig
					);
				case 'pie':
					return renderPieChart(data, xAxisKey, availableMetricKeys);
				case 'multi_line':
					return renderMultiLineChart(
						data,
						xAxisKey,
						availableMetricKeys,
						chartConfig
					);
				case 'stacked_bar':
					return renderStackedBarChart(
						data,
						xAxisKey,
						availableMetricKeys,
						chartConfig
					);
				case 'grouped_bar':
					return renderGroupedBarChart(data, xAxisKey, availableMetricKeys);
				case 'scatter':
					return renderScatterChart(data, availableMetricKeys);
				case 'radar':
					return renderRadarChart(
						data,
						xAxisKey,
						availableMetricKeys,
						chartConfig
					);
				case 'funnel':
					return renderFunnelChart(data, xAxisKey, availableMetricKeys);
				default:
					return (
						<div className="flex h-full items-center justify-center text-muted-foreground">
							<p>Unsupported chart type: {aiChartType}</p>
						</div>
					);
			}
		};

		return (
			<div className="fade-in-0 slide-in-from-bottom-2 animate-in space-y-4 duration-500">
				{showMetricsChart &&
					chartDisplayConfig.chartDataForDisplay.length > 0 && (
						<div className="fade-in-0 slide-in-from-top-1 animate-in rounded-lg bg-muted/30 p-2 shadow-sm delay-100 duration-700">
							<ChartContainer className="h-[260px] w-full" config={chartConfig}>
								<ResponsiveContainer>{renderChart()}</ResponsiveContainer>
							</ChartContainer>
						</div>
					)}

				<div className="fade-in-0 slide-in-from-bottom-1 animate-in delay-200 duration-700">
					<DataTable
						className="bg-background/70 backdrop-blur-sm"
						columns={columnsForTable}
						data={rawAiData}
						description={`Full data (${rawAiData.length} rows). Click headers to sort.`}
						emptyMessage="No data to display in table."
						initialPageSize={7}
						minHeight={300}
						showSearch={rawAiData.length > 7}
						title="Detailed Data"
					/>
				</div>
			</div>
		);
	};

	const getChartTypeDescription = (chartType?: string) => {
		if (!chartType) {
			return 'Data';
		}
		switch (chartType.toLowerCase()) {
			case 'multi_line':
				return 'Multi-Series Line Chart';
			case 'stacked_bar':
				return 'Stacked Bar Chart';
			case 'grouped_bar':
				return 'Grouped Bar Chart';
			case 'area':
				return 'Area Chart';
			case 'line':
				return 'Line Chart';
			case 'bar':
				return 'Bar Chart';
			case 'pie':
				return 'Pie Chart';
			case 'scatter':
				return 'Scatter Chart';
			case 'radar':
				return 'Radar Chart';
			case 'funnel':
				return 'Funnel Chart';
			default:
				return chartType
					.replace(/_/g, ' ')
					.replace(/\b\w/g, (l) => l.toUpperCase());
		}
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border bg-background shadow-sm transition-all duration-300">
			<div
				className={`flex flex-shrink-0 items-center gap-2 border-b p-3 transition-all duration-300 ${websiteData ? 'bg-muted/30' : 'bg-muted/10'}`}
			>
				<div
					className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded transition-all duration-300 ${websiteData ? 'bg-primary/10' : 'bg-muted/20'}`}
				>
					<TrendUp
						className={`h-4 w-4 transition-all duration-300 ${websiteData ? 'text-primary' : 'text-muted-foreground/60'}`}
					/>
				</div>
				<div className="min-w-0 flex-1">
					<h2
						className={`truncate font-semibold text-base transition-all duration-300 ${websiteData ? 'text-foreground' : 'text-muted-foreground/80'}`}
					>
						Data Visualization
					</h2>
				</div>
				{latestAssistantMsg?.chartType && websiteData && (
					<Badge
						className="fade-in-0 slide-in-from-right-1 animate-in gap-1 whitespace-nowrap px-2 py-1 text-xs duration-300"
						variant="outline"
					>
						{getChartIcon(latestAssistantMsg.chartType)}
						{getChartTypeDescription(latestAssistantMsg.chartType)}
						{rawAiData && rawAiData.length > 0 && ` (${rawAiData.length})`}
					</Badge>
				)}
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto">
				<ScrollArea className="h-full">
					<div
						className={`p-3 transition-all duration-300 ${websiteData ? 'opacity-100' : 'opacity-90'}`}
					>
						{renderChartContent()}
					</div>
				</ScrollArea>
			</div>
		</div>
	);
}

const REFERRER_NAME_MAP: Record<string, string> = {
	'google.com': 'Google',
	'www.google.com': 'Google',
	'm.google.com': 'Google',
	't.co': 'Twitter / X',
	'twitter.com': 'Twitter / X',
	'x.com': 'Twitter / X',
	'facebook.com': 'Facebook',
	'www.facebook.com': 'Facebook',
	'm.facebook.com': 'Facebook',
	'linkedin.com': 'LinkedIn',
	'www.linkedin.com': 'LinkedIn',
	'bing.com': 'Bing',
	'www.bing.com': 'Bing',
	'duckduckgo.com': 'DuckDuckGo',
	'yahoo.com': 'Yahoo',
	'yandex.com': 'Yandex',
	'baidu.com': 'Baidu',
	'github.com': 'GitHub',
	'producthunt.com': 'Product Hunt',
	'reddit.com': 'Reddit',
	'www.reddit.com': 'Reddit',
	'dev.to': 'DEV Community',
	'medium.com': 'Medium',
	'stackoverflow.com': 'Stack Overflow',
	'slack.com': 'Slack',
	localhost: 'Localhost',
};

function getReferrerDisplayName(referrer: string | unknown): string {
	if (
		referrer === null ||
		referrer === '' ||
		(typeof referrer === 'string' && referrer.toLowerCase() === '(direct)')
	) {
		return 'Direct';
	}
	if (typeof referrer !== 'string' || !referrer.trim()) {
		return 'Unknown';
	}

	const trimmedReferrer = referrer.trim();

	try {
		const fullUrl =
			trimmedReferrer.startsWith('http://') ||
			trimmedReferrer.startsWith('https://')
				? trimmedReferrer
				: `http://${trimmedReferrer}`;
		const url = new URL(fullUrl);
		const hostname = url.hostname;

		const baseHostname = hostname.startsWith('www.')
			? hostname.substring(4)
			: hostname;

		if (REFERRER_NAME_MAP[hostname]) {
			return REFERRER_NAME_MAP[hostname];
		}
		if (hostname !== baseHostname && REFERRER_NAME_MAP[baseHostname]) {
			return REFERRER_NAME_MAP[baseHostname];
		}

		return baseHostname.charAt(0).toUpperCase() + baseHostname.slice(1);
	} catch (e) {
		console.error(e);
		return trimmedReferrer.charAt(0).toUpperCase() + trimmedReferrer.slice(1);
	}
}

const generateColumns = (
	data: ChartDataItem[]
): ColumnDef<ChartDataItem, any>[] => {
	if (!data || data.length === 0 || !data[0]) {
		return [];
	}
	const firstItemKeys = Object.keys(data[0]);

	return firstItemKeys.map((key) => ({
		accessorKey: key,
		header: key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
		cell: ({ row }) => {
			const value = row.getValue(key);
			if (typeof value === 'number') {
				return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
			}
			if (
				typeof value === 'string' &&
				(key.toLowerCase().includes('referrer') ||
					key.toLowerCase().includes('source'))
			) {
				return getReferrerDisplayName(value);
			}
			return String(value);
		},
	}));
};

// Moved TIME_KEYS to be globally accessible if needed by future helpers or for clarity.
const TIME_KEYS = ['date', 'time', 'hour', 'day', 'week', 'month', 'timestamp'];

const transformDataForMetricsChart = (
	rawData: any[],
	chartTypeInput?: string
	// aiQuery parameter removed as it was unused
): TransformResult => {
	if (!rawData || rawData.length === 0 || !rawData[0]) {
		return { chartData: [], xAxisKey: 'date' };
	}

	let determinedXAxisKey = 'date';
	const chartType = chartTypeInput?.toLowerCase();
	// TIME_KEYS is now global. Other constants remain local as they are only used within this function scope.
	const DATE_ALIASES = [
		'date',
		'time',
		'day',
		'timestamp',
		'category',
		'label',
		'name',
		'month',
		'year',
		'hour',
		'period',
		'referrer',
		'source',
	];
	const PRIMARY_METRIC_ALIASES = [
		'pageviews',
		'page_views',
		'page views',
		'count',
		'visits',
		'value',
		'sessions',
		'users',
		'total',
		'metric',
		'records',
		'events',
		'avg_load_time',
		'load_time',
	];
	const SECONDARY_METRIC_ALIASES = [
		'visitors',
		'unique_visitors',
		'unique visitors',
		'users',
		'distinct_users',
		'uniques',
	];

	if (chartType === 'multi_line') {
		const firstItemKeys = Object.keys(rawData[0]);
		const timeCol = firstItemKeys.find(
			(k: string) => k.toLowerCase() === 'date' || k.toLowerCase() === 'hour'
		);
		let categoryCol: string | undefined;
		let metricCol: string | undefined;

		if (timeCol) {
			categoryCol = firstItemKeys.find(
				(k: string) => k !== timeCol && typeof rawData[0][k] === 'string'
			);
			metricCol = firstItemKeys.find(
				(k: string) => k !== timeCol && typeof rawData[0][k] === 'number'
			);
		}

		if (timeCol && categoryCol && metricCol) {
			determinedXAxisKey = timeCol;
			const pivotedData: { [key: string]: ChartDataItem } = {};
			const _timeCol = timeCol;
			const _categoryCol = categoryCol;
			const _metricCol = metricCol;

			for (const item of rawData) {
				const timeVal = String(item[_timeCol]);
				let categoryVal = String(item[_categoryCol]);
				const metricVal = Number(item[_metricCol]);

				if (_categoryCol.toLowerCase().includes('path')) {
					categoryVal =
						categoryVal.startsWith('/') && categoryVal.length > 1
							? categoryVal.substring(1)
							: categoryVal;
					categoryVal = categoryVal.split('?')[0] || 'Home';
					if (categoryVal.length > 20) {
						categoryVal = `${categoryVal.substring(0, 17)}...`;
					}
				}
				if (!pivotedData[timeVal]) {
					pivotedData[timeVal] = { [_timeCol]: timeVal };
				}
				pivotedData[timeVal][categoryVal] = metricVal;
			}

			const allCategoryKeys = new Set<string>();
			for (const item of rawData) {
				let categoryVal = String(item[_categoryCol]);
				if (_categoryCol.toLowerCase().includes('path')) {
					categoryVal =
						categoryVal.startsWith('/') && categoryVal.length > 1
							? categoryVal.substring(1)
							: categoryVal;
					categoryVal = categoryVal.split('?')[0] || 'Home';
					if (categoryVal.length > 20) {
						categoryVal = `${categoryVal.substring(0, 17)}...`;
					}
				}
				allCategoryKeys.add(categoryVal);
			}

			const result = Object.values(pivotedData).map(
				(dataPoint: ChartDataItem) => {
					const completeDataPoint = { ...dataPoint };
					for (const catKey of allCategoryKeys) {
						if (!Object.hasOwn(completeDataPoint, catKey)) {
							completeDataPoint[catKey] = null;
						}
					}
					return completeDataPoint;
				}
			);

			if (TIME_KEYS.includes(_timeCol.toLowerCase())) {
				try {
					result.sort(
						(a, b) =>
							new Date(a[_timeCol]).getTime() - new Date(b[_timeCol]).getTime()
					);
				} catch (e) {
					/* ignore sort error for non-standard time keys */
				}
			}
			return { chartData: result, xAxisKey: determinedXAxisKey };
		}
	}

	const firstItemKeys = Object.keys(rawData[0]);
	const identifiedTimeKeyForSingleSeries = firstItemKeys.find((key: string) =>
		TIME_KEYS.includes(key.toLowerCase())
	);
	const identifiedMetricKey = firstItemKeys.find(
		(key: string) =>
			key !== identifiedTimeKeyForSingleSeries &&
			typeof rawData[0][key] === 'number'
	);

	determinedXAxisKey = 'date';

	const transformedChartData = rawData.map((item) => {
		const transformed: ChartDataItem = {};
		const originalKeys = Object.keys(item);
		const usedOriginalKeys = new Set<string>();
		const dateField = determinedXAxisKey;

		let categoryValueToSet: string | number | Date | undefined | null;
		let foundDateKeyActual: string | undefined =
			identifiedTimeKeyForSingleSeries;

		if (foundDateKeyActual && originalKeys.includes(foundDateKeyActual)) {
			categoryValueToSet = item[foundDateKeyActual];
			usedOriginalKeys.add(foundDateKeyActual);
		} else {
			// DATE_ALIASES is defined locally
			foundDateKeyActual = originalKeys.find((k: string) =>
				DATE_ALIASES.includes(k.toLowerCase())
			);
			if (foundDateKeyActual) {
				categoryValueToSet = item[foundDateKeyActual];
				usedOriginalKeys.add(foundDateKeyActual);
			}
		}

		if (
			categoryValueToSet === undefined &&
			(chartType === 'bar' || chartType === 'pie')
		) {
			const stringKey = originalKeys.find(
				(k: string) => typeof item[k] === 'string' && !usedOriginalKeys.has(k)
			);
			if (stringKey) {
				categoryValueToSet = item[stringKey];
				foundDateKeyActual = stringKey;
				usedOriginalKeys.add(stringKey);
			}
		}

		if (categoryValueToSet === undefined && originalKeys.length > 0) {
			const firstNonUsedKey = originalKeys.find(
				(k: string) => !usedOriginalKeys.has(k)
			);
			if (firstNonUsedKey) {
				categoryValueToSet = String(item[firstNonUsedKey]);
				foundDateKeyActual = firstNonUsedKey;
				usedOriginalKeys.add(firstNonUsedKey);
			}
		}

		if (chartType === 'bar' && typeof categoryValueToSet === 'string') {
			const keyUsedForCategoryIsReferrer =
				(foundDateKeyActual || '').toLowerCase().includes('referrer') ||
				(foundDateKeyActual || '').toLowerCase().includes('source');
			const potentialReferrerIndicators = [
				'/',
				'.com',
				'.net',
				'.org',
				'http',
				'www',
			];
			if (
				keyUsedForCategoryIsReferrer ||
				potentialReferrerIndicators.some((indicator) =>
					categoryValueToSet.toLowerCase().includes(indicator)
				)
			) {
				transformed[dateField] = getReferrerDisplayName(categoryValueToSet);
			} else {
				transformed[dateField] = categoryValueToSet;
			}
		} else if (
			typeof categoryValueToSet === 'object' &&
			categoryValueToSet !== null &&
			categoryValueToSet instanceof Date
		) {
			transformed[dateField] = categoryValueToSet.toISOString().split('T')[0];
		} else {
			transformed[dateField] = String(categoryValueToSet ?? 'Unknown');
		}

		const primaryMetricField = identifiedMetricKey || 'pageviews';
		transformed[primaryMetricField] = null;

		// PRIMARY_METRIC_ALIASES is defined locally
		const currentPrimaryMetricAliases = [...PRIMARY_METRIC_ALIASES];
		if (
			identifiedMetricKey &&
			!currentPrimaryMetricAliases.includes(identifiedMetricKey.toLowerCase())
		) {
			currentPrimaryMetricAliases.push(identifiedMetricKey.toLowerCase());
		}

		let foundPrimaryMetricKey = originalKeys.find(
			(k: string) =>
				currentPrimaryMetricAliases.includes(k.toLowerCase()) &&
				!usedOriginalKeys.has(k) &&
				k !== foundDateKeyActual &&
				typeof item[k] === 'number'
		);

		if (!foundPrimaryMetricKey) {
			foundPrimaryMetricKey =
				identifiedMetricKey &&
				!usedOriginalKeys.has(identifiedMetricKey) &&
				typeof item[identifiedMetricKey] === 'number'
					? identifiedMetricKey
					: originalKeys.find(
							(k: string) =>
								typeof item[k] === 'number' &&
								!usedOriginalKeys.has(k) &&
								k !== foundDateKeyActual
						);
		}

		if (foundPrimaryMetricKey && item[foundPrimaryMetricKey] !== undefined) {
			transformed[primaryMetricField] =
				Number(item[foundPrimaryMetricKey]) || 0;
			usedOriginalKeys.add(foundPrimaryMetricKey);
		} else if (
			Object.keys(transformed).length === 1 &&
			identifiedMetricKey &&
			item[identifiedMetricKey] !== undefined
		) {
			transformed[identifiedMetricKey] = Number(item[identifiedMetricKey]) || 0;
			usedOriginalKeys.add(identifiedMetricKey);
		}

		if (chartType === 'line' || chartType === 'area') {
			const visitorsMetricName = 'visitors';
			// SECONDARY_METRIC_ALIASES is defined locally
			const foundSecondaryMetricKey = originalKeys.find(
				(k: string) =>
					SECONDARY_METRIC_ALIASES.includes(k.toLowerCase()) &&
					!usedOriginalKeys.has(k) &&
					k !== foundDateKeyActual &&
					k !== foundPrimaryMetricKey &&
					typeof item[k] === 'number'
			);
			if (
				foundSecondaryMetricKey &&
				item[foundSecondaryMetricKey] !== undefined
			) {
				transformed[visitorsMetricName] =
					Number(item[foundSecondaryMetricKey]) || 0;
				usedOriginalKeys.add(foundSecondaryMetricKey);
			}
		}

		for (const key of originalKeys) {
			if (
				typeof item[key] === 'number' &&
				!usedOriginalKeys.has(key) &&
				key !== foundDateKeyActual
			) {
				const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '_');
				if (!Object.hasOwn(transformed, sanitizedKey)) {
					transformed[sanitizedKey] = Number(item[key]) || 0;
				}
			}
		}
		return transformed;
	});
	return { chartData: transformedChartData, xAxisKey: determinedXAxisKey };
};
