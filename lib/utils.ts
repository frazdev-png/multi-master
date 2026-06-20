import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, options: Intl.NumberFormatOptions = {}) {
  const value = Number(amount || 0)
  const minimumFractionDigits =
    typeof options.minimumFractionDigits === "number" ? options.minimumFractionDigits : 2
  const maximumFractionDigits =
    typeof options.maximumFractionDigits === "number" ? options.maximumFractionDigits : 2

  const { minimumFractionDigits: _min, maximumFractionDigits: _max, style: _style, currency: _currency, ...rest } = options

  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits,
    maximumFractionDigits,
    ...rest,
  }).format(value)

  return `${formatted} USDT`
}
