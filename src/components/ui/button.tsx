import { cn } from '@/lib/utils'
import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'default' | 'sm' | 'lg'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ 
  className, 
  variant = 'default', 
  size = 'default', 
  children, 
  ...props 
}, ref) => {
  const variants = {
    default: 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700',
    ghost: 'hover:bg-zinc-800/30',
    outline: 'border border-zinc-600 text-zinc-400 hover:bg-zinc-800/30',
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
        'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
})

Button.displayName = 'Button'
