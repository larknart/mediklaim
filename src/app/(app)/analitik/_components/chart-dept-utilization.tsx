"use client";

import { Bar, BarChart, XAxis, YAxis, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DeptUtilRow } from "@/app/api/charts/all/route";

const chartConfig = {
  pct: { label: "% Digunakan", color: "#15803d" },
} satisfies ChartConfig;

export function ChartDeptUtilization({ data }: { data: DeptUtilRow[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Penggunaan Peruntukan Jabatan</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-56">
          <p className="text-gray-400 text-sm">Tiada data untuk tempoh ini</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    name: d.name,
    pct: d.limit_myr > 0 ? Math.min(Math.round((d.used / d.limit_myr) * 100), 100) : 0,
    used: d.used,
    limit: d.limit_myr,
  }));

  const barHeight = 28;
  const chartHeight = Math.max(160, chartData.length * (barHeight + 12) + 32);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Penggunaan Peruntukan Jabatan</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} style={{ height: chartHeight }} className="w-full">
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={104}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v, _n, item) => [
                    `${v}% · RM ${Number(item.payload?.used ?? 0).toFixed(2)} / RM ${Number(item.payload?.limit ?? 0).toFixed(2)}`,
                    "Guna pakai" as string,
                  ]}
                />
              }
            />
            <Bar dataKey="pct" radius={[0, 3, 3, 0]} maxBarSize={barHeight}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={
                    entry.pct >= 90 ? "#ef4444" : entry.pct >= 70 ? "#f59e0b" : "#15803d"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
