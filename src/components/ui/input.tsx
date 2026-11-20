import * as React from "react"

import { cn } from "@/lib/utils"

interface InputProps extends React.ComponentProps<"input"> {
  label?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type, label, error, leftIcon, rightIcon, id, ...props },
    ref
  ) => {
    const generatedId = React.useId()
    const inputId = id ?? generatedId

    const control = (
      <div className="relative w-full min-w-0 flex-1">
        {leftIcon && (
          <div className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground">
            {leftIcon}
          </div>
        )}
        <input
          type={type}
          id={inputId}
          className={cn(
            "flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-base font-medium text-slate-900 shadow-xs transition-[border-color,box-shadow,background-color] duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-[var(--brand-blue)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-blue)]/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 md:text-sm",
            leftIcon && "pl-10",
            rightIcon && "pr-10",
            error && "border-error-600 focus-visible:ring-error-600",
            className
          )}
          ref={ref}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground">
            {rightIcon}
          </div>
        )}
      </div>
    )

    if (!label && !error) {
      return control
    }

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-sm font-bold text-slate-800"
          >
            {label}
          </label>
        )}
        {control}
        {error && <p className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
