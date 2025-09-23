"use client";

import * as React from "react";

import {
  buttonStyles,
  type ButtonVariant,
} from "@/components/ui/button-variants";

type Ripple = {
  id: number;
  x: number;
  y: number;
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      variant = "primary",
      onPointerDown,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const [ripples, setRipples] = React.useState<Ripple[]>([]);

    const handlePointerDown = (
      event: React.PointerEvent<HTMLButtonElement>,
    ) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);

      setRipples((prev) => [
        ...prev,
        {
          id: Date.now(),
          x: event.clientX - rect.left - size / 2,
          y: event.clientY - rect.top - size / 2,
        },
      ]);

      onPointerDown?.(event);
    };

    React.useEffect(() => {
      if (ripples.length === 0) return;

      const timeout = window.setTimeout(() => {
        setRipples((prev) => prev.slice(1));
      }, 450);

      return () => window.clearTimeout(timeout);
    }, [ripples]);

    return (
      <button
        ref={ref}
        className={buttonStyles(variant, className)}
        type={type}
        onPointerDown={handlePointerDown}
        {...props}
      >
        <span aria-hidden className="absolute inset-0 overflow-hidden">
          {ripples.map((ripple) => (
            <span
              key={ripple.id}
              className="pointer-events-none absolute h-[180px] w-[180px] rounded-full bg-white/35 blur-md animate-ripple dark:bg-white/20"
              style={{ left: ripple.x, top: ripple.y }}
            />
          ))}
        </span>
        <span className="relative z-10 inline-flex items-center gap-2">
          {children}
        </span>
      </button>
    );
  },
);

Button.displayName = "Button";
