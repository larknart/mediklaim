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
  total: { label: "Jumlah (RM)", color: "#15803d" },
} satisfies ChartConfig;

interface Props {
  data: { month: number; total: number }[];
  year: number;
}

export function ChartSpendingTrend({ data, year }: Props) {
  const chartData = data.map((d) => ({ ...d, monthLabel: MONTHS[d.month - 1] }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Perbelanjaan Bulanan {year}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-48 w-full">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `RM${v}`}
              width={48}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v) => `RM ${Number(v).toFixed(2)}`}
                />
              }
            />
            <Bar dataKey="total" fill="var(--color-total)" radius={[3, 3, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
