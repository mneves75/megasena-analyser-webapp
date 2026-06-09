'use client';

import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface BarChartProps {
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  title?: string;
  color?: string;
}

export function BarChart({ data, xKey, yKey, title = 'Gráfico de barras', color = 'hsl(var(--primary))' }: BarChartProps) {
  const summaryItems = data.slice(0, 12).map((item) => `${String(item[xKey])}: ${String(item[yKey])}`);

  return (
    <figure aria-label={title}>
      <figcaption className="sr-only">{title}</figcaption>
      <ul className="sr-only">
        {summaryItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={300}>
          <RechartsBarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey={xKey}
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--foreground))',
              }}
            />
            <Legend />
            <Bar dataKey={yKey} fill={color} radius={[8, 8, 0, 0]} />
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
