import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

const gapMap = {
  sm: "gap-4",
  md: "gap-6",
  lg: "gap-8",
  xl: "gap-12",
} as const;

type GapSize = keyof typeof gapMap;

type StackProps<T extends ElementType = "div"> = {
  as?: T;
  gap?: GapSize;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

export function Stack<T extends ElementType = "div">({
  as,
  gap = "md",
  className,
  children,
  ...props
}: StackProps<T>) {
  const Component = (as ?? "div") as ElementType;

  return (
    <Component
      className={cn("flex flex-col", gapMap[gap], className)}
      {...props}
    >
      {children}
    </Component>
  );
}
