"use client";

import { Pie, PieChart, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ByStatusRow } from "@/app/api/charts/all/route";

const STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT:            { label: "Draf",              color: "#94a3b8" },
  SUBMITTED:        { label: "Dihantar",          color: "#3b82f6" },
  HEAD_APPROVED:    { label: "Sokong KJ",         color: "#8b5cf6" },
  FINANCE_REVIEWED: { label: "Semakan Kewangan",  color: "#f59e0b" },
  APPROVED:         { label: "Diluluskan",        color: "#22c55e" },
  REJECTED:         { label: "Ditolak",           color: "#ef4444" },
  PAID:             { label: "Dibayar",           color: "#10b981" },
};

export function ChartSystemStatus({ data }: { data: ByStatusRow[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Status Tuntutan Sistem</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-56">
          <p className="text-gray-400 text-sm">Tiada data untuk tempoh ini</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: STATUS_META[d.status]?.label ?? d.status,
    fill: STATUS_META[d.status]?.color ?? "#94a3b8",
  }));

  const chartConfig = Object.fromEntries(
    chartData.map((d) => [d.status, { label: d.label, color: d.fill }])
  ) as ChartConfig;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Status Tuntutan Sistem</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-48 w-full">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="status"
              innerRadius={48}
              outerRadius={80}
            >
              {chartData.map((entry) => (
                <Cell key={entry.status} fill={entry.fill} />
              ))}
            </Pie>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => [
                    `${value} tuntutan`,
                    item.payload?.label ?? (item.name as string),
                  ]}
                />
              }
            />
          </PieChart>
        </ChartContainer>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {chartData.map((d) => (
            <span key={d.status} className="flex items-center gap-1 text-xs text-gray-600">
              <span
                className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                style={{ backgroundColor: d.fill }}
              />
              {d.label} ({d.count})
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
