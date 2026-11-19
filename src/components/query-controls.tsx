"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ChoiceGroup({
  label,
  value,
  options,
  param,
  pathname,
  preserved,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  param: string;
  pathname: string;
  preserved: Record<string, string | undefined>;
}) {
  const router = useRouter();

  function select(next: string) {
    const params = new URLSearchParams();
    for (const [key, preservedValue] of Object.entries(preserved)) {
      if (preservedValue) params.set(key, preservedValue);
    }
    params.set(param, next);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              onClick={() => select(option.value)}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export function SalesSelect({
  value,
  options,
  param,
  pathname,
  preserved,
  includeAll,
}: {
  value: string;
  options: { value: string; label: string }[];
  param: string;
  pathname: string;
  preserved: Record<string, string | undefined>;
  includeAll: boolean;
}) {
  const router = useRouter();

  return (
    <label className="block space-y-2 text-sm font-medium">
      Sales
      <select
        className="block h-9 w-full max-w-xs rounded-lg border border-input bg-card px-2.5 text-sm font-normal"
        value={value}
        aria-label="Filter sales"
        onChange={(event) => {
          const params = new URLSearchParams();
          for (const [key, preservedValue] of Object.entries(preserved)) {
            if (preservedValue) params.set(key, preservedValue);
          }
          if (event.target.value) params.set(param, event.target.value);
          const query = params.toString();
          router.replace(query ? `${pathname}?${query}` : pathname);
        }}
      >
        {includeAll ? <option value="">Semua sales</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
