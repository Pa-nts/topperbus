// WKU Academic Calendar - Break periods when transit is not in service
// These dates should be updated annually from: https://www.wku.edu/registrar/academic_calendars/

interface BreakPeriod {
  name: string;
  start: Date;
  end: Date;
}

// Define break periods for the current academic year
// Dates are based on WKU 2024-2025 Academic Calendar
const BREAK_PERIODS: BreakPeriod[] = [
  // Fall 2024
  { 
    name: 'Fall Break', 
    start: new Date(2024, 9, 7),  // October 7, 2024
    end: new Date(2024, 9, 8)     // October 8, 2024
  },
  { 
    name: 'Thanksgiving Break', 
    start: new Date(2024, 10, 27), // November 27, 2024
    end: new Date(2024, 10, 29)    // November 29, 2024
  },
  { 
    name: 'Winter Break', 
    start: new Date(2024, 11, 12), // December 12, 2024 (after finals end Dec 11)
    end: new Date(2025, 0, 20)     // January 20, 2025 (MLK Day)
  },
  
  // Spring 2025
  { 
    name: 'Spring Break', 
    start: new Date(2025, 2, 17),  // March 17, 2025
    end: new Date(2025, 2, 21)     // March 21, 2025
  },
  { 
    name: 'Summer Break', 
    start: new Date(2025, 4, 9),   // May 9, 2025 (after spring commencement)
    end: new Date(2025, 7, 18)     // August 18, 2025 (fall classes begin Aug 19)
  },
  
  // Fall 2025 (projected - update when official calendar released)
  { 
    name: 'Fall Break', 
    start: new Date(2025, 9, 6),   // Early October 2025 (estimate)
    end: new Date(2025, 9, 7)
  },
  { 
    name: 'Thanksgiving Break', 
    start: new Date(2025, 10, 26), // Late November 2025 (estimate)
    end: new Date(2025, 10, 28)
  },
  { 
    name: 'Winter Break', 
    start: new Date(2025, 11, 5),  // December 2025 (estimate)
    end: new Date(2026, 0, 19)     // January 2026 (estimate)
  },
];

/**
 * Check if a given date falls within a school break period
 * @param date The date to check (defaults to now)
 * @returns The break period if currently in one, null otherwise
 */
export const getCurrentBreakPeriod = (date: Date = new Date()): BreakPeriod | null => {
  // Normalize the date to start of day for comparison
  const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  for (const period of BREAK_PERIODS) {
    const start = new Date(period.start.getFullYear(), period.start.getMonth(), period.start.getDate());
    const end = new Date(period.end.getFullYear(), period.end.getMonth(), period.end.getDate());
    
    if (checkDate >= start && checkDate <= end) {
      return period;
    }
  }
  
  return null;
};

/**
 * Check if school is currently in session
 * @param date The date to check (defaults to now)
 * @returns true if school is in session, false if on break
 */
export const isSchoolInSession = (date: Date = new Date()): boolean => {
  return getCurrentBreakPeriod(date) === null;
};

/**
 * Format the break period dates for display
 * @param period The break period
 * @returns Formatted date range string
 */
export const formatBreakDates = (period: BreakPeriod): string => {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const startStr = period.start.toLocaleDateString('en-US', options);
  const endStr = period.end.toLocaleDateString('en-US', options);
  
  if (startStr === endStr) {
    return startStr;
  }
  
  // If same month, shorten the format
  if (period.start.getMonth() === period.end.getMonth()) {
    return `${period.start.toLocaleDateString('en-US', { month: 'short' })} ${period.start.getDate()}-${period.end.getDate()}`;
  }
  
  return `${startStr} - ${endStr}`;
};

/**
 * Get the next upcoming break period
 * @param date The reference date (defaults to now)
 * @returns The next break period, or null if none found
 */
export const getNextBreakPeriod = (date: Date = new Date()): BreakPeriod | null => {
  const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  for (const period of BREAK_PERIODS) {
    const start = new Date(period.start.getFullYear(), period.start.getMonth(), period.start.getDate());
    if (start > checkDate) {
      return period;
    }
  }
  
  return null;
};
