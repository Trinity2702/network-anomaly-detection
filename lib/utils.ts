import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely formats a number to a fixed decimal string.
 * Handles undefined, null, NaN, and non-numeric strings gracefully.
 */
export function formatSafeNumber(value: any, decimals: number = 2, fallback: string = "N/A"): string {
  if (value === undefined || value === null) return fallback;
  
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  
  return num.toFixed(decimals);
}
