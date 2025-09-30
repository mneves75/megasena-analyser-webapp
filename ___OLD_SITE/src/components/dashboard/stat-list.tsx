import { Badge } from "@/components/ui/badge";

const numberFormatter = new Intl.NumberFormat("pt-BR");
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});

export type StatListItem = {
  dezena: number;
  hits: number;
  percentage: number;
  contestsSinceLast: number | null;
};

export type StatListProps = {
  title: string;
  description?: string;
  items: StatListItem[];
  badge?: { label: string; variant?: "default" | "success" | "secondary" };
  accent?: "hot" | "cold";
};

export function StatList({
  title,
  description,
  items,
  badge,
  accent = "hot",
}: StatListProps) {
  const accentClasses =
    accent === "hot"
      ? {
          chip: "bg-green-500 text-white",
          container:
            "border-green-200/60 bg-green-50 dark:border-green-500/20 dark:bg-green-900/20",
        }
      : {
          chip: "bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900",
          container:
            "border-slate-200/70 bg-white/90 dark:border-slate-600/30 dark:bg-slate-800/40",
        };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            {title}
          </p>
          {description ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {description}
            </p>
          ) : null}
        </div>
        {badge ? (
          <Badge variant={badge.variant ?? "secondary"} size="sm">
            {badge.label}
          </Badge>
        ) : null}
      </div>

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.dezena}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-soft transition-colors ${accentClasses.container}`}
          >
            <span
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${accentClasses.chip}`}
            >
              {item.dezena.toString().padStart(2, "0")}
            </span>
            <div className="flex flex-1 flex-col gap-1">
              <span className="font-medium text-slate-900 dark:text-white">
                {numberFormatter.format(item.hits)} ocorrências
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {percentFormatter.format(item.percentage)} dos concursos
                {item.contestsSinceLast !== null
                  ? ` · há ${item.contestsSinceLast} concursos`
                  : ""}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
