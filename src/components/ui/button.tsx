"use client";

import * as React from "react";

import {
  buttonStyles,
  type ButtonVariant,
  type ButtonSize,
} from "@/components/ui/button-variants";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      variant = "primary",
      size = "md",
      type = "button",
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={buttonStyles(variant, size, className)}
        type={type}
        {...props}
      >
        <span className="inline-flex items-center gap-2">{children}</span>
      </button>
    );
  },
);

Button.displayName = "Button";
