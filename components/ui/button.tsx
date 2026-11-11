'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-semibold transition-smooth focus-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/85',
        outline: 'border border-primary bg-transparent text-primary hover:bg-tint',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'px-4 py-2',
        sm: 'px-3 py-2',
        lg: 'px-6 py-3 text-base',
        icon: 'w-11 px-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function renderButtonAsChild(
  child: React.ReactNode,
  props: React.HTMLAttributes<HTMLElement>
): React.ReactElement | null {
  const element = React.Children.toArray(child).find(React.isValidElement) as
    | React.ReactElement<{ className?: string }>
    | undefined;

  if (!element) {
    return null;
  }

  return React.cloneElement(element, {
    ...props,
    className: cn(props.className, element.props.className),
  });
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, type, ...props }, ref) => {
    if (asChild) {
      return renderButtonAsChild(children, {
        ...props,
        className: cn(buttonVariants({ variant, size, className })),
      });
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={type ?? 'button'}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
