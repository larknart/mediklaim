"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Role } from "@/generated/prisma";
import { ChartDeptClaims } from "./chart-dept-claims";
import { ChartMonthlyTrend } from "./chart-monthly-trend";
import { ChartDeptUtilization } from "./chart-dept-utilization";
import { ChartSystemStatus } from "./chart-system-status";
import type { AllChartsData } from "@/app/api/charts/all/route";

interface Department {
  id: string;
  name: string;
}

interface Props {
  initialData: AllChartsData;
  initialYear: number;
  departments: Department[];
  userRoles: Role[];
  userDeptId: string | null;
}

const SENIOR_ROLES: Role[] = [Role.FINANCE, Role.APPROVER, Role.YDP, Role.ADMIN];

export function AnalitikFilters({
  initialData,
  initialYear,
  departments,
  userRoles,
  userDeptId,
}: Props) {
  const isHeadOnly =
    userRoles.includes(Role.HEAD) && !userRoles.some((r) => SENIOR_ROLES.includes(r));

  const yearOptions = Array.from({ length: 5 }, (_, i) => initialYear - i);

  const [year, setYear] = useState(initialYear);
  const [dept, setDept] = useState(isHeadOnly ? (userDeptId ?? "") : "");
  const [data, setData] = useState<AllChartsData>(initialData);

  const isFirstRender = useRef(true);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams({ year: String(year) });
    if (dept) params.set("dept", dept);
    try {
      const res = await fetch(`/api/charts/all?${params}`);
      if (res.ok) setData(await res.json());
    } catch {
      // network error — keep stale data
    }
  }, [year, dept]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      intervalId = setInterval(fetchData, 60_000);
    };
    const stop = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    if (isFirstRender.current) {
      isFirstRender.current = false;
    } else {
      fetchData();
    }
    start();

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        fetchData();
        start();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchData]); // re-runs when year or dept changes (fetchData memoised on them)

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Tahun:</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {!isHeadOnly && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Jabatan:</label>
            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="">Semua Jabatan</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Chart C: by dept */}
      <ChartDeptClaims data={data.byDepartment} />

      {/* Chart D + F side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartMonthlyTrend data={data.monthlyTrend} />
        <ChartSystemStatus data={data.byStatus} />
      </div>

      {/* Chart E: utilization */}
      <ChartDeptUtilization data={data.deptUtilization} />
    </div>
  );
}
