'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface DonutChartProps {
  data: Array<{
    name: string;
    value: number;
    color?: string;
  }>;
  title?: string;
}

const DEFAULT_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function DonutChart({ data, title = 'Gráfico de distribuição' }: DonutChartProps) {
  return (
    <figure aria-label={title}>
      <figcaption className="sr-only">{title}</figcaption>
      <ul className="sr-only">
        {data.map((entry) => (
          <li key={entry.name}>
            {entry.name}: {entry.value}
          </li>
        ))}
      </ul>
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => {
                const fallbackColor = DEFAULT_COLORS[index % DEFAULT_COLORS.length] ?? 'hsl(var(--chart-1))';
                return <Cell key={`cell-${index}`} fill={entry.color ?? fallbackColor} />;
              })}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--foreground))',
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
