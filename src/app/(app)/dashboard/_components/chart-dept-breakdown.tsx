"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const chartConfig = {
  claimCount: { label: "Bil. Tuntutan", color: "#1d4ed8" },
  totalClaimed: { label: "Nilai (RM)", color: "#15803d" },
} satisfies ChartConfig;

interface DeptRow {
  deptName: string | null;
  claimCount: number;
  totalClaimed: number;
}

interface Props {
  data: DeptRow[];
  year: number;
}

export function ChartDeptBreakdown({ data, year }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    deptName: d.deptName ?? "(Tiada Jabatan)",
    totalClaimed: Math.round(d.totalClaimed),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Tuntutan Mengikut Jabatan {year}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 8 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="deptName"
              width={120}
              tick={{ fontSize: 11 }}
              tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 17) + "…" : v}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="claimCount" fill="var(--color-claimCount)" radius={2} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
