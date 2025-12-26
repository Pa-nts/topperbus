// WKU Academic Calendar - Break periods when transit is not in service
// These dates should be updated annually from: https://www.wku.edu/registrar/academic_calendars/
// A Discord notification will be sent on January 1st to remind you to update these dates

interface BreakPeriod {
  name: string;
  start: Date;
  end: Date;
}

// Define break periods for the current academic year
// Last updated: December 2024
// Buses DO NOT run during winter semester - only fall and spring
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
    end: new Date(2025, 0, 19)     // January 19, 2025 (day before spring classes start Jan 20)
  },
  
  // Spring 2026
  { 
    name: 'Spring Break', 
    start: new Date(2026, 2, 16),  // March 16, 2026
    end: new Date(2026, 2, 20)     // March 20, 2026
  },
  { 
    name: 'Summer Break', 
    start: new Date(2026, 4, 8),   // May 8, 2026 (after spring commencement May 7)
    end: new Date(2026, 7, 17)     // August 17, 2026 (day before fall classes start Aug 18)
  },
  
  // Fall 2025
  { 
    name: 'Fall Break', 
    start: new Date(2025, 9, 6),   // October 6, 2025
    end: new Date(2025, 9, 7)      // October 7, 2025
  },
  { 
    name: 'Thanksgiving Break', 
    start: new Date(2025, 10, 26), // November 26, 2025
    end: new Date(2025, 10, 28)    // November 28, 2025
  },
  { 
    name: 'Winter Break', 
    start: new Date(2025, 11, 12), // December 12, 2025 (after finals end Dec 11)
    end: new Date(2026, 0, 19)     // January 19, 2026 (day before spring classes start Jan 20)
  },
];

// Sort break periods by start date for proper ordering
BREAK_PERIODS.sort((a, b) => a.start.getTime() - b.start.getTime());

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

/**
 * Get the last defined break period end date
 * Used to determine if calendar needs updating
 */
export const getLastDefinedDate = (): Date => {
  if (BREAK_PERIODS.length === 0) {
    return new Date();
  }
  
  let lastDate = BREAK_PERIODS[0].end;
  for (const period of BREAK_PERIODS) {
    if (period.end > lastDate) {
      lastDate = period.end;
    }
  }
  
  return lastDate;
};
