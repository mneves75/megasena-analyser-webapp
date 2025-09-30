"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = "text",
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      id,
      ...props
    },
    ref,
  ) => {
    // React.useId guarantees hydration-safe IDs even when there are multiple inputs rendered at once.
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    // Track focus so we can adapt styling (placeholder weight, ring, etc.) without relying solely on :focus CSS.
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      props.onFocus?.(e);
    };

    // Persist whether the field keeps content after blur to fine-tune helper visibility.
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      props.onBlur?.(e);
    };

    // Keep optimistic value tracking even for controlled inputs where parent manages state.
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      props.onChange?.(e);
    };

    // Layout: stack label + field with consistent vertical rhythm so long labels never collide with the value slot.
    return (
      <div className="space-y-3">
        {label && (
          <label
            htmlFor={inputId}
            // The label stays outside of the field to avoid cramped compositions when the copy is verbose.
            className="block text-sm font-semibold tracking-tight text-slate-700 dark:text-slate-200"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            // Icon container uses absolute centering so the clickable area remains predictable.
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            className={cn(
              // Taller field + rounded-2xl keeps parity with card aesthetics and fixes cramped vertical padding for long labels.
              "flex h-12 w-full rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-200 ease-out focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-brand-400 dark:focus:bg-slate-900/60",
              leftIcon && "pl-11",
              rightIcon && "pr-11",
              error &&
                "border-red-500 focus:border-red-500 focus:ring-red-500/20",
              className,
            )}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
            aria-invalid={error ? "true" : "false"}
            {...props}
          />
          {rightIcon && (
            // Right affordance slot accepts buttons (e.g., regenerate seed) without affecting internal padding.
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p
            id={errorId}
            className="mt-1 text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p
            id={helperId}
            className="mt-1 text-sm text-slate-500 dark:text-slate-400"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export { Input };
