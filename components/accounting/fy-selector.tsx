import Link from "next/link";

import { cn } from "@/lib/utils/cn";

const FY_OPTIONS = ["2026-27", "2025-26"] as const;

type Props = {
  financialYear: string;
  basePath: string;
  extraQuery?: Record<string, string>;
};

export function FySelector({ financialYear, basePath, extraQuery = {} }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {FY_OPTIONS.map((fy) => {
        const params = new URLSearchParams({ ...extraQuery, fy });
        const href = `${basePath}?${params.toString()}`;
        return (
          <Link
            key={fy}
            href={href}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              fy === financialYear
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            FY {fy}
          </Link>
        );
      })}
    </div>
  );
}
