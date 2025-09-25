"use client";

import * as React from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

import { cn } from "@/lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  placeholder?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}

function toOptionValue(input: SelectProps["value"]): string {
  if (input === undefined || input === null) {
    return "";
  }
  if (Array.isArray(input)) {
    return input[0] ?? "";
  }
  return String(input);
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      placeholder = "Selecione uma opção",
      options,
      id,
      value,
      defaultValue,
      onChange,
      onBlur,
      onFocus,
      ...rest
    },
    ref,
  ) => {
    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = React.useState(() =>
      toOptionValue(defaultValue),
    );

    const normalizedValue = isControlled ? toOptionValue(value) : internalValue;
    const hasValue = normalizedValue.length > 0;

    const generatedId = React.useId();
    const selectId = id || generatedId;
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;

    const handleFocus = (event: React.FocusEvent<HTMLSelectElement>) => {
      onFocus?.(event);
    };

    const handleBlur = (event: React.FocusEvent<HTMLSelectElement>) => {
      if (!isControlled) {
        setInternalValue(event.target.value);
      }
      onBlur?.(event);
    };

    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
      if (!isControlled) {
        setInternalValue(event.target.value);
      }
      onChange?.(event);
    };

    return (
      <div className="space-y-2">
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              "flex h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white/85 px-4 py-2.5 pr-10 text-sm text-slate-900 transition-all duration-200 ease-out focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:bg-slate-800",
              error &&
                "border-red-500 focus:border-red-500 focus:ring-red-500/20",
              className,
            )}
            value={isControlled ? (value ?? "") : undefined}
            defaultValue={
              !isControlled ? toOptionValue(defaultValue) : undefined
            }
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
            aria-invalid={error ? "true" : "false"}
            {...rest}
          >
            <option value="" disabled={!hasValue}>
              {placeholder}
            </option>
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        {error && (
          <p id={errorId} className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p
            id={helperId}
            className="text-sm text-slate-500 dark:text-slate-400"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";

export { Select };
