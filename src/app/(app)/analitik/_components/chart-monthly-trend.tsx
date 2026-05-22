"use client";

import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MonthlyTrendRow } from "@/app/api/charts/all/route";

const MONTHS = ["Jan","Feb","Mac","Apr","Mei","Jun","Jul","Ogs","Sep","Okt","Nov","Dis"];

const chartConfig = {
  total: { label: "Nilai (RM)", color: "#15803d" },
} satisfies ChartConfig;

export function ChartMonthlyTrend({ data }: { data: MonthlyTrendRow[] }) {
  const chartData = data.map((d) => ({ ...d, monthLabel: MONTHS[d.month - 1] }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Trend Nilai Bulanan</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-56 w-full">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `RM${v}`}
              width={56}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v, _n, item) => [
                    `RM ${Number(v).toFixed(2)} · ${item.payload?.count ?? 0} tuntutan`,
                    "Nilai" as string,
                  ]}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="var(--color-total)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
