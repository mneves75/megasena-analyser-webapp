'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-smooth active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-elegant',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        default: 'px-4 py-2',
        sm: 'rounded-md px-3 py-2',
        lg: 'px-8 py-3',
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
