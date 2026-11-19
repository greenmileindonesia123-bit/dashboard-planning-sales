import { Card, CardDescription, CardHeader } from "@/components/ui/card";

export function KpiGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} size="sm">
          <CardHeader>
            <CardDescription>{item.label}</CardDescription>
            <dd className="font-heading text-2xl tabular-nums tracking-tight">{item.value}</dd>
          </CardHeader>
        </Card>
      ))}
    </dl>
  );
}
