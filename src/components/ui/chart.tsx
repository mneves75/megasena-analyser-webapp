"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface ChartData {
  label: string;
  value: number;
  color?: string;
}

export interface ChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: ChartData[];
  type?: "bar" | "line" | "pie" | "donut";
  showLabels?: boolean;
  showValues?: boolean;
  maxValue?: number;
  height?: number;
}

const Chart = React.forwardRef<HTMLDivElement, ChartProps>(
  (
    {
      className,
      data,
      type = "bar",
      showLabels = true,
      showValues = true,
      maxValue,
      height = 200,
      ...props
    },
    ref,
  ) => {
    const max = maxValue || Math.max(...data.map((d) => d.value));
    const total = data.reduce((sum, d) => sum + d.value, 0);

    const defaultColors = [
      "#2F7BFF", // brand-500
      "#8B5CF6", // purple-500
      "#06B6D4", // cyan-500
      "#10B981", // emerald-500
      "#F59E0B", // amber-500
      "#EF4444", // red-500
    ];

    const getColor = (index: number, customColor?: string) => {
      return customColor || defaultColors[index % defaultColors.length];
    };

    const renderBarChart = () => (
      <div className="flex items-end justify-between gap-2 h-full">
        {data.map((item, index) => {
          const percentage = (item.value / max) * 100;
          return (
            <div key={item.label} className="flex flex-col items-center flex-1">
              <div className="relative w-full bg-slate-200 dark:bg-slate-700 rounded-t-lg overflow-hidden">
                <div
                  className="transition-all duration-1000 ease-out"
                  style={{
                    height: `${percentage}%`,
                    backgroundColor: getColor(index, item.color),
                  }}
                />
                {showValues && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                    {item.value}
                  </div>
                )}
              </div>
              {showLabels && (
                <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 text-center">
                  {item.label}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );

    const renderPieChart = () => {
      let currentAngle = 0;
      const radius = 80;
      const centerX = 100;
      const centerY = 100;

      return (
        <div className="relative">
          <svg width="200" height="200" className="mx-auto">
            {data.map((item, index) => {
              const percentage = (item.value / total) * 100;
              const angle = (percentage / 100) * 360;
              const startAngle = currentAngle;
              const endAngle = currentAngle + angle;

              const startAngleRad = (startAngle * Math.PI) / 180;
              const endAngleRad = (endAngle * Math.PI) / 180;

              const x1 = centerX + radius * Math.cos(startAngleRad);
              const y1 = centerY + radius * Math.sin(startAngleRad);
              const x2 = centerX + radius * Math.cos(endAngleRad);
              const y2 = centerY + radius * Math.sin(endAngleRad);

              const largeArcFlag = angle > 180 ? 1 : 0;

              const pathData = [
                `M ${centerX} ${centerY}`,
                `L ${x1} ${y1}`,
                `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                "Z",
              ].join(" ");

              currentAngle += angle;

              return (
                <path
                  key={item.label}
                  d={pathData}
                  fill={getColor(index, item.color)}
                  className="transition-all duration-1000 ease-out"
                />
              );
            })}
          </svg>
          {showValues && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {total}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Total
                </div>
              </div>
            </div>
          )}
        </div>
      );
    };

    const renderDonutChart = () => {
      let currentAngle = 0;
      const radius = 60;
      const centerX = 100;
      const centerY = 100;
      const strokeWidth = 20;

      return (
        <div className="relative">
          <svg width="200" height="200" className="mx-auto">
            <circle
              cx={centerX}
              cy={centerY}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-slate-200 dark:text-slate-700"
            />
            {data.map((item, index) => {
              const percentage = (item.value / total) * 100;
              const angle = (percentage / 100) * 360;
              const startAngle = currentAngle;
              const endAngle = currentAngle + angle;

              const startAngleRad = (startAngle * Math.PI) / 180;
              const endAngleRad = (endAngle * Math.PI) / 180;

              const x1 = centerX + radius * Math.cos(startAngleRad);
              const y1 = centerY + radius * Math.sin(startAngleRad);
              const x2 = centerX + radius * Math.cos(endAngleRad);
              const y2 = centerY + radius * Math.sin(endAngleRad);

              const largeArcFlag = angle > 180 ? 1 : 0;

              const pathData = [
                `M ${x1} ${y1}`,
                `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
              ].join(" ");

              currentAngle += angle;

              return (
                <path
                  key={item.label}
                  d={pathData}
                  fill="none"
                  stroke={getColor(index, item.color)}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              );
            })}
          </svg>
          {showValues && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {total}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Total
                </div>
              </div>
            </div>
          )}
        </div>
      );
    };

    const renderChart = () => {
      switch (type) {
        case "bar":
          return renderBarChart();
        case "pie":
          return renderPieChart();
        case "donut":
          return renderDonutChart();
        default:
          return renderBarChart();
      }
    };

    return (
      <div
        ref={ref}
        className={cn("w-full", className)}
        style={{ height: `${height}px` }}
        {...props}
      >
        {renderChart()}
        {showLabels && type !== "bar" && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {data.map((item, index) => (
              <div key={item.label} className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: getColor(index, item.color) }}
                />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {item.label}
                </span>
                {showValues && (
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {item.value}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
);

Chart.displayName = "Chart";

export { Chart };
