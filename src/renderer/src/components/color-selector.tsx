'use client'

import { useState, type JSX } from 'react'
import { cn } from '@/lib/utils'

interface ColorSelectorProps {
  colors: string[]
  size?: 'default' | 'sm' | 'lg' | 'xl'
  defaultValue: string
  name?: string
  onColorSelect?: (color: string) => void
  className?: string
}

const colorMap = {
  default: 'var(--foreground)',
  red: 'var(--color-red-500)',
  green: 'var(--color-green-500)',
  blue: 'var(--color-blue-500)',
  yellow: 'var(--color-yellow-500)',
  purple: 'var(--color-purple-500)',
  pink: 'var(--color-pink-500)',
  indigo: 'var(--color-indigo-500)',
  orange: 'var(--color-orange-500)',
  teal: 'var(--color-teal-500)',
  cyan: 'var(--color-cyan-500)',
  lime: 'var(--color-lime-500)',
  emerald: 'var(--color-emerald-500)',
  violet: 'var(--color-violet-500)',
  fuchsia: 'var(--color-fuchsia-500)',
  rose: 'var(--color-rose-500)',
  sky: 'var(--color-sky-500)',
  amber: 'var(--color-amber-500)'
} as const

export function ColorSelector({
  colors,
  size = 'default',
  defaultValue,
  name,
  onColorSelect,
  className
}: ColorSelectorProps): JSX.Element {
  const [selectedColor, setSelectedColor] = useState<string>(defaultValue)

  const handleColorSelect = (color: string): void => {
    setSelectedColor(color)
    onColorSelect?.(color)
  }

  const getSizeClass = (variant: 'default' | 'sm' | 'lg' | 'xl'): string => {
    switch (variant) {
      case 'sm':
        return 'size-4'
      case 'default':
        return 'size-5'
      case 'lg':
        return 'size-6'
      case 'xl':
        return 'size-8'
      default:
        return 'size-5'
    }
  }

  const getColorValue = (color: string): string => {
    return colorMap[color as keyof typeof colorMap] || color
  }

  const sizeClass = getSizeClass(size)

  return (
    <div className={cn('flex gap-2', className)}>
      {name && <input type="hidden" name={name} value={selectedColor} />}
      {colors.map((color) => {
        const colorValue = getColorValue(color)
        return (
          <div
            key={color}
            className={cn(
              sizeClass,
              'cursor-pointer rounded-full transition-transform duration-200 active:scale-90',
              selectedColor === color && 'ring-2 ring-gray-400 ring-offset-2'
            )}
            style={{
              backgroundColor: colorValue,
              ...(selectedColor === color && {
                boxShadow: `inset 0 0 0 2px var(--background), 0 0 0 2px ${colorValue}`
              })
            }}
            onClick={() => handleColorSelect(color)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleColorSelect(color)
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`Select ${color} color`}
            aria-pressed={selectedColor === color}
          />
        )
      })}
    </div>
  )
}
