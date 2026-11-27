import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-[transform,background-color,box-shadow,color,border-color] duration-200 ease-out active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-55 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[var(--color-primary-600)]",
        primary:
          "bg-primary text-primary-foreground hover:bg-[var(--color-primary-600)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-slate-200 bg-white text-slate-800 shadow-xs hover:border-[var(--brand-blue)]/50 hover:text-[var(--color-primary-700)]",
        secondary:
          "bg-slate-100 text-slate-900 hover:bg-slate-200/80",
        ghost: "hover:bg-slate-100 hover:text-slate-900 hover:translate-y-0",
        link: "text-primary underline-offset-4 hover:underline hover:translate-y-0",
        premium: "btn-premium text-white",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 rounded-lg px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 rounded-2xl px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {/* Keep the label in the layout while loading so the button never changes width. */}
            <span
              className={cn(
                "inline-flex items-center justify-center gap-2 transition-opacity",
                isLoading && "opacity-0"
              )}
            >
              {children}
            </span>
            {isLoading && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="cm-dots" aria-hidden>
                  <span />
                  <span />
                  <span />
                </span>
                <span className="sr-only">Loading...</span>
              </span>
            )}
          </>
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
