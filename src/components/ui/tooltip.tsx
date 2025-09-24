"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface TooltipProps {
  content: React.ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
  delay?: number;
  children: React.ReactNode;
  className?: string;
}

const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(
  ({ className, content, placement = "top", delay = 200, children }, ref) => {
    const [isVisible, setIsVisible] = React.useState(false);
    const [position, setPosition] = React.useState({ x: 0, y: 0 });
    const triggerRef = React.useRef<HTMLDivElement>(null);
    const tooltipRef = React.useRef<HTMLDivElement>(null);
    const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const assignTriggerRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        triggerRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    const showTooltip = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, delay);
    };

    const hideTooltip = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setIsVisible(false);
    };

    const updatePosition = React.useCallback(() => {
      if (!triggerRef.current || !tooltipRef.current) return;

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;

      let x = 0;
      let y = 0;

      switch (placement) {
        case "top":
          x =
            triggerRect.left +
            scrollX +
            triggerRect.width / 2 -
            tooltipRect.width / 2;
          y = triggerRect.top + scrollY - tooltipRect.height - 8;
          break;
        case "bottom":
          x =
            triggerRect.left +
            scrollX +
            triggerRect.width / 2 -
            tooltipRect.width / 2;
          y = triggerRect.bottom + scrollY + 8;
          break;
        case "left":
          x = triggerRect.left + scrollX - tooltipRect.width - 8;
          y =
            triggerRect.top +
            scrollY +
            triggerRect.height / 2 -
            tooltipRect.height / 2;
          break;
        case "right":
          x = triggerRect.right + scrollX + 8;
          y =
            triggerRect.top +
            scrollY +
            triggerRect.height / 2 -
            tooltipRect.height / 2;
          break;
      }

      setPosition({ x, y });
    }, [placement]);

    React.useEffect(() => {
      if (isVisible) {
        updatePosition();
        const handleScroll = () => updatePosition();
        const handleResize = () => updatePosition();

        window.addEventListener("scroll", handleScroll);
        window.addEventListener("resize", handleResize);

        return () => {
          window.removeEventListener("scroll", handleScroll);
          window.removeEventListener("resize", handleResize);
        };
      }
    }, [isVisible, placement, updatePosition]);

    React.useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    const placementClasses = {
      top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
      bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
      left: "right-full top-1/2 -translate-y-1/2 mr-2",
      right: "left-full top-1/2 -translate-y-1/2 ml-2",
    };

    const arrowClasses = {
      top: "top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-slate-900 dark:border-t-slate-100",
      bottom:
        "bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-slate-900 dark:border-b-slate-100",
      left: "left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-slate-900 dark:border-l-slate-100",
      right:
        "right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-slate-900 dark:border-r-slate-100",
    };

    return (
      <div
        ref={assignTriggerRef}
        className="relative inline-block"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
        {isVisible && (
          <div
            ref={tooltipRef}
            className={cn(
              "absolute z-50 px-3 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg shadow-lg dark:bg-slate-100 dark:text-slate-900",
              placementClasses[placement],
              className,
            )}
            style={{
              position: "fixed",
              left: position.x,
              top: position.y,
            }}
          >
            {content}
            <div
              className={cn(
                "absolute w-0 h-0 border-4",
                arrowClasses[placement],
              )}
            />
          </div>
        )}
      </div>
    );
  },
);

Tooltip.displayName = "Tooltip";

export { Tooltip };
