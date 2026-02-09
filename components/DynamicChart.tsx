"use client";

import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";
import { TrendingUp } from "lucide-react";

export interface ChartConfig {
  chartType: "bar" | "line" | "pie" | "area" | "scatter";
  title: string;
  xKey: string;
  yKeys: string[];
  colors: string[];
  insight: string;
}

interface DynamicChartProps {
  config: ChartConfig;
  data: Record<string, string | number | null>[];
}

const DEFAULT_COLORS = [
  "#4F46E5",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
  "#F97316",
  "#14B8A6",
];

// Custom tooltip component for consistent styling
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      {label !== undefined && (
        <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
      )}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-zinc-600 dark:text-zinc-300">
            {entry.name}:
          </span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {typeof entry.value === "number"
              ? entry.value.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// Custom pie chart label
function renderPieLabel(props: PieLabelRenderProps) {
  const name = String(props.name ?? "");
  const percent = Number(props.percent ?? 0);
  if (percent < 0.03) return "";
  return `${name} (${(percent * 100).toFixed(1)}%)`;
}

export default function DynamicChart({ config, data }: DynamicChartProps) {
  const { chartType, title, xKey, yKeys, colors, insight } = config;

  const resolvedColors = useMemo(() => {
    return yKeys.map(
      (_, i) => colors[i] || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    );
  }, [yKeys, colors]);

  // Prepare data: ensure numeric values for yKeys
  const preparedData = useMemo(() => {
    return data.map((row) => {
      const prepared: Record<string, string | number | null> = { ...row };
      for (const key of yKeys) {
        const val = row[key];
        if (val !== null && val !== undefined) {
          const num = Number(val);
          if (!isNaN(num)) {
            prepared[key] = num;
          }
        }
      }
      // Truncate long x-axis labels for display
      if (
        typeof prepared[xKey] === "string" &&
        (prepared[xKey] as string).length > 25
      ) {
        prepared[xKey] = (prepared[xKey] as string).substring(0, 22) + "...";
      }
      return prepared;
    });
  }, [data, xKey, yKeys]);

  // For pie charts, prepare aggregated data
  const pieData = useMemo(() => {
    if (chartType !== "pie" || yKeys.length === 0) return [];
    const yKey = yKeys[0];
    return preparedData.map((row, index) => ({
      name: String(row[xKey] ?? `Item ${index + 1}`),
      value: typeof row[yKey] === "number" ? row[yKey] : Number(row[yKey]) || 0,
    }));
  }, [chartType, preparedData, xKey, yKeys]);

  const commonAxisProps = {
    tick: { fontSize: 12, fill: "#71717a" },
    axisLine: { stroke: "#e4e4e7" },
    tickLine: { stroke: "#e4e4e7" },
  };

  const renderChart = () => {
    switch (chartType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={380}>
            <BarChart
              data={preparedData}
              margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e740" />
              <XAxis
                dataKey={xKey}
                {...commonAxisProps}
                angle={preparedData.length > 8 ? -35 : 0}
                textAnchor={preparedData.length > 8 ? "end" : "middle"}
                height={preparedData.length > 8 ? 80 : 40}
                interval={
                  preparedData.length > 20
                    ? Math.floor(preparedData.length / 20)
                    : 0
                }
              />
              <YAxis
                {...commonAxisProps}
                tickFormatter={(val: number) =>
                  val >= 1000000
                    ? `${(val / 1000000).toFixed(1)}M`
                    : val >= 1000
                      ? `${(val / 1000).toFixed(1)}K`
                      : String(val)
                }
              />
              <Tooltip content={<CustomTooltip />} />
              {yKeys.length > 1 && <Legend />}
              {yKeys.map((key, i) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={resolvedColors[i]}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={60}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case "line":
        return (
          <ResponsiveContainer width="100%" height={380}>
            <LineChart
              data={preparedData}
              margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e740" />
              <XAxis
                dataKey={xKey}
                {...commonAxisProps}
                angle={preparedData.length > 10 ? -35 : 0}
                textAnchor={preparedData.length > 10 ? "end" : "middle"}
                height={preparedData.length > 10 ? 80 : 40}
                interval={
                  preparedData.length > 30
                    ? Math.floor(preparedData.length / 30)
                    : 0
                }
              />
              <YAxis
                {...commonAxisProps}
                tickFormatter={(val: number) =>
                  val >= 1000000
                    ? `${(val / 1000000).toFixed(1)}M`
                    : val >= 1000
                      ? `${(val / 1000).toFixed(1)}K`
                      : String(val)
                }
              />
              <Tooltip content={<CustomTooltip />} />
              {yKeys.length > 1 && <Legend />}
              {yKeys.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={resolvedColors[i]}
                  strokeWidth={2}
                  dot={preparedData.length <= 30}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case "area":
        return (
          <ResponsiveContainer width="100%" height={380}>
            <AreaChart
              data={preparedData}
              margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
            >
              <defs>
                {yKeys.map((key, i) => (
                  <linearGradient
                    key={key}
                    id={`gradient-${i}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={resolvedColors[i]}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={resolvedColors[i]}
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e740" />
              <XAxis
                dataKey={xKey}
                {...commonAxisProps}
                angle={preparedData.length > 10 ? -35 : 0}
                textAnchor={preparedData.length > 10 ? "end" : "middle"}
                height={preparedData.length > 10 ? 80 : 40}
                interval={
                  preparedData.length > 30
                    ? Math.floor(preparedData.length / 30)
                    : 0
                }
              />
              <YAxis
                {...commonAxisProps}
                tickFormatter={(val: number) =>
                  val >= 1000000
                    ? `${(val / 1000000).toFixed(1)}M`
                    : val >= 1000
                      ? `${(val / 1000).toFixed(1)}K`
                      : String(val)
                }
              />
              <Tooltip content={<CustomTooltip />} />
              {yKeys.length > 1 && <Legend />}
              {yKeys.map((key, i) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={resolvedColors[i]}
                  strokeWidth={2}
                  fill={`url(#gradient-${i})`}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case "pie":
        return (
          <ResponsiveContainer width="100%" height={380}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={130}
                innerRadius={60}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                label={renderPieLabel}
                labelLine={{ stroke: "#71717a", strokeWidth: 1 }}
              >
                {pieData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      resolvedColors[index % resolvedColors.length] ||
                      DEFAULT_COLORS[index % DEFAULT_COLORS.length]
                    }
                    strokeWidth={1}
                    stroke="#fff"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case "scatter":
        return (
          <ResponsiveContainer width="100%" height={380}>
            <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e740" />
              <XAxis
                dataKey={xKey}
                name={xKey}
                type="number"
                {...commonAxisProps}
              />
              <YAxis
                dataKey={yKeys[0]}
                name={yKeys[0]}
                type="number"
                {...commonAxisProps}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ strokeDasharray: "3 3" }}
              />
              <Scatter
                name={`${xKey} vs ${yKeys[0]}`}
                data={preparedData}
                fill={resolvedColors[0]}
                fillOpacity={0.7}
              />
            </ScatterChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <div className="flex h-48 items-center justify-center text-sm text-zinc-500">
            Unsupported chart type: {chartType}
          </div>
        );
    }
  };

  return (
    <div className="space-y-3">
      {/* Chart header */}
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-sm font-semibold text-[#933333]">{title}</h3>
        <span className="inline-flex items-center gap-1 border border-[#933333]/30 bg-[#933333]/5 px-2 py-0.5 text-xs font-medium text-[#933333]/70 capitalize">
          {chartType} chart
        </span>
      </div>

      {/* Chart */}
      <div className="border border-[#933333]/20 bg-white p-4">
        {renderChart()}
      </div>

      {/* Insight */}
      {insight && (
        <div className="flex items-start gap-2 border border-[#933333]/30 bg-[#933333]/5 px-3 py-2">
          <TrendingUp className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#933333]" />
          <p className="text-sm text-[#933333]">{insight}</p>
        </div>
      )}
    </div>
  );
}
