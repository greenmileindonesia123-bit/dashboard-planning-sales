"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber, formatRp } from "@/lib/format";

export type PairRow = {
  label: string;
  bulanIni: number;
  bulanLalu: number;
};

export type RankRow = {
  name: string;
  value: number;
};

const THIS_MONTH = "var(--chart-1)";
const LAST_MONTH = "var(--chart-2)";

export function ComparisonChart({
  title,
  description,
  rows,
  formatValue,
}: {
  title: string;
  description: string;
  rows: PairRow[];
  formatValue: "number" | "rupiah";
}) {
  const format = formatValue === "rupiah" ? formatRp : formatNumber;
  const max = Math.max(0, ...rows.flatMap((row) => [row.bulanIni, row.bulanLalu]));
  return (
    <figure className="space-y-3">
      <figcaption>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </figcaption>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12 }}
              interval={0}
              angle={rows.some((row) => row.label.length > 12) ? -30 : 0}
              textAnchor={rows.some((row) => row.label.length > 12) ? "end" : "middle"}
              height={rows.some((row) => row.label.length > 12) ? 70 : 30}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              width={72}
              domain={[0, max === 0 ? 1 : "auto"]}
              tickFormatter={(value: number) => format(value)}
            />
            <Tooltip formatter={(value) => format(Number(value ?? 0))} />
            <Legend />
            <Bar dataKey="bulanIni" name="Bulan ini" fill={THIS_MONTH} radius={3} />
            <Bar dataKey="bulanLalu" name="Bulan lalu" fill={LAST_MONTH} radius={3} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export function RankingChart({
  title,
  description,
  rows,
  formatValue,
}: {
  title: string;
  description: string;
  rows: RankRow[];
  formatValue: "number" | "rupiah";
}) {
  const format = formatValue === "rupiah" ? formatRp : formatNumber;
  const max = Math.max(0, ...rows.map((row) => row.value));
  const height = Math.max(240, rows.length * 36);
  return (
    <figure className="space-y-3">
      <figcaption>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </figcaption>
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis
              type="number"
              domain={[0, max === 0 ? 1 : "auto"]}
              tick={{ fontSize: 12 }}
              tickFormatter={(value: number) => format(value)}
            />
            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => format(Number(value ?? 0))} />
            <Bar dataKey="value" name="Bulan ini" fill={THIS_MONTH} radius={3} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
