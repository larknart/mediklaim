"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MONTHS = ["Jan","Feb","Mac","Apr","Mei","Jun","Jul","Ogs","Sep","Okt","Nov","Dis"];

const chartConfig = {
  total: { label: "Nilai (RM)", color: "#1d4ed8" },
} satisfies ChartConfig;

interface Props {
  data: { month: number; total: number; count: number }[];
  year: number;
}

export function ChartMiniMonthly({ data, year }: Props) {
  const chartData = data.map((d) => ({ ...d, monthLabel: MONTHS[d.month - 1] }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Trend Bulanan Sistem {year}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-40 w-full">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="monthLabel" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `RM${v}`}
              width={44}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v, _n, item) => [
                    `RM ${Number(v).toFixed(2)} · ${item.payload?.count ?? 0} tuntutan`,
                    "Nilai",
                  ]}
                />
              }
            />
            <Bar dataKey="total" fill="var(--color-total)" radius={[2, 2, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
