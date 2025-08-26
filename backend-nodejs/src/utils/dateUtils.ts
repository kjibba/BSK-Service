/**
 * Utility functions for date formatting
 */

/**
 * Format a date as European date string (DD.MM.YYYY)
 * @param date - The date to format
 * @returns Formatted date string or null if date is null/undefined
 */
export function formatEuropeanDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}.${month}.${year}`;
}

/**
 * Format a date as European datetime string (DD.MM.YYYY HH:MM)
 * @param date - The date to format
 * @returns Formatted datetime string or null if date is null/undefined
 */
export function formatEuropeanDateTime(date: Date | null | undefined): string | null {
  if (!date) return null;
  
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}
