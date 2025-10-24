/**
 * Market Hours Utility
 * Checks if Indian stock market is open
 */

/**
 * Check if market is currently open
 * Indian Market Hours: 9:15 AM - 3:30 PM IST (Monday-Friday)
 */
export function isMarketOpen(): boolean {
  // Get current time in IST (UTC+5:30)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const istTime = new Date(now.getTime() + istOffset);
  
  // Get day of week (0 = Sunday, 6 = Saturday)
  const day = istTime.getUTCDay();
  
  // Check if weekend
  if (day === 0 || day === 6) {
    return false; // Market closed on weekends
  }
  
  // Get hours and minutes in IST
  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();
  const timeInMinutes = hours * 60 + minutes;
  
  // Market hours: 9:15 AM (555 minutes) to 3:30 PM (930 minutes)
  const marketOpen = 9 * 60 + 15;  // 9:15 AM = 555 minutes
  const marketClose = 15 * 60 + 30; // 3:30 PM = 930 minutes
  
  return timeInMinutes >= marketOpen && timeInMinutes <= marketClose;
}

/**
 * Get market status with details
 */
export function getMarketStatus(): {
  isOpen: boolean;
  status: 'LIVE' | 'CLOSED' | 'WEEKEND' | 'PRE_OPEN';
  message: string;
  nextOpen?: string;
} {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  
  const day = istTime.getUTCDay();
  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();
  const timeInMinutes = hours * 60 + minutes;
  
  // Weekend
  if (day === 0 || day === 6) {
    const daysUntilMonday = day === 0 ? 1 : 2;
    return {
      isOpen: false,
      status: 'WEEKEND',
      message: 'Market closed for weekend',
      nextOpen: `Opens Monday at 9:15 AM IST`
    };
  }
  
  // Pre-open session (9:00 AM - 9:15 AM)
  const preOpenStart = 9 * 60; // 9:00 AM
  const marketOpen = 9 * 60 + 15; // 9:15 AM
  
  if (timeInMinutes >= preOpenStart && timeInMinutes < marketOpen) {
    return {
      isOpen: false,
      status: 'PRE_OPEN',
      message: 'Pre-open session',
      nextOpen: 'Opens at 9:15 AM IST'
    };
  }
  
  // Market hours (9:15 AM - 3:30 PM)
  const marketClose = 15 * 60 + 30; // 3:30 PM
  
  if (timeInMinutes >= marketOpen && timeInMinutes <= marketClose) {
    return {
      isOpen: true,
      status: 'LIVE',
      message: 'Market is open'
    };
  }
  
  // After market close
  if (timeInMinutes > marketClose) {
    return {
      isOpen: false,
      status: 'CLOSED',
      message: 'Market closed for the day',
      nextOpen: 'Opens tomorrow at 9:15 AM IST'
    };
  }
  
  // Before market open
  return {
    isOpen: false,
    status: 'CLOSED',
    message: 'Market not yet open',
    nextOpen: 'Opens at 9:15 AM IST'
  };
}

/**
 * Get current IST time
 */
export function getISTTime(): Date {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset);
}

/**
 * Format time in IST
 */
export function formatISTTime(date: Date = new Date()): string {
  const istTime = getISTTime();
  return istTime.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}
