import React from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'default' | 'sm' | 'lg'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700',
      ghost: 'hover:bg-zinc-800/50 text-zinc-200',
      outline: 'border border-zinc-700 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200',
    }
    const sizes = {
      default: 'py-2 px-4 text-sm',
      sm: 'py-1.5 px-3 text-sm',
      lg: 'py-3 px-6 text-base',
    }

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none disabled:opacity-50 cursor-pointer',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'