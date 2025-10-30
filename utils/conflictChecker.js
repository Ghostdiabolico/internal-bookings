// utils/conflictChecker.js
import { pool } from '../db.js';

/**
 * Check if a booking time conflicts with existing bookings
 * @param {string} date - Booking date (YYYY-MM-DD)
 * @param {string} startTime - Start time (HH:MM)
 * @param {string} finishTime - Finish time (HH:MM)
 * @param {number|null} excludeBookingId - Booking ID to exclude (for edits)
 * @returns {Promise<Array>} Array of conflicting bookings
 */
export async function checkBookingConflicts(date, startTime, finishTime, excludeBookingId = null) {
  try {
    // Validate inputs
    if (!date || !startTime || !finishTime) {
      console.warn('⚠️ Conflict check called with missing parameters');
      return [];
    }

    // Build query to find overlapping bookings
    let query = `
      SELECT 
        id, 
        requester, 
        email,
        type_of_use, 
        start_time, 
        finish_time, 
        status,
        event_name
      FROM pool_bookings
      WHERE date = $1
        AND status IN ('approved', 'pending')
        AND (
          -- New booking starts during existing booking
          (start_time < $3 AND finish_time > $2) OR
          -- New booking contains existing booking
          (start_time >= $2 AND finish_time <= $3) OR
          -- Existing booking starts during new booking
          (start_time >= $2 AND start_time < $3)
        )
    `;
    
    const params = [date, startTime, finishTime];
    
    // Exclude current booking when editing
    if (excludeBookingId) {
      query += ` AND id != $4`;
      params.push(excludeBookingId);
    }
    
    query += ` ORDER BY start_time`;

    const result = await pool.query(query, params);
    
    console.log(`🔍 Conflict check: Found ${result.rows.length} conflict(s) for ${date} ${startTime}-${finishTime}`);
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error checking conflicts:', error);
    throw error;
  }
}

/**
 * Format conflict information for display
 * @param {Array} conflicts - Array of conflict objects
 * @returns {string} Formatted conflict message
 */
export function formatConflictMessage(conflicts) {
  if (conflicts.length === 0) {
    return '';
  }

  let message = `⚠️ Time conflict detected! The pool is already booked during this time:\n\n`;
  
  conflicts.forEach((conflict, index) => {
    const timeRange = `${conflict.start_time.slice(0, 5)} - ${conflict.finish_time.slice(0, 5)}`;
    const status = conflict.status === 'approved' ? '✅ Approved' : '⏳ Pending';
    const eventInfo = conflict.event_name ? ` - ${conflict.event_name}` : '';
    
    message += `${index + 1}. ${conflict.requester}${eventInfo}\n`;
    message += `   Time: ${timeRange} (${status})\n`;
    message += `   Type: ${conflict.type_of_use}\n\n`;
  });
  
  message += `Please choose a different time slot.`;
  
  return message;
}

/**
 * Suggest available time slots near the requested time
 * @param {string} date - Booking date
 * @param {string} preferredStartTime - Preferred start time
 * @param {number} durationMinutes - Booking duration in minutes
 * @returns {Promise<Array>} Array of suggested time slots
 */
export async function suggestAvailableSlots(date, preferredStartTime, durationMinutes = 60) {
  try {
    // Get all bookings for that day
    const result = await pool.query(
      `SELECT start_time, finish_time 
       FROM pool_bookings 
       WHERE date = $1 
       AND status IN ('approved', 'pending')
       ORDER BY start_time`,
      [date]
    );
    
    const bookedSlots = result.rows;
    const suggestions = [];
    
    // Define pool operating hours (adjust as needed)
    const poolOpenTime = '06:00';
    const poolCloseTime = '21:00';
    
    // Helper function to add minutes to time
    function addMinutes(time, minutes) {
      const [h, m] = time.split(':').map(Number);
      const date = new Date(2000, 0, 1, h, m);
      date.setMinutes(date.getMinutes() + minutes);
      return date.toTimeString().slice(0, 5);
    }
    
    // Helper function to check if time is within a slot
    function isTimeInSlot(time, slotStart, slotEnd) {
      return time >= slotStart && time < slotEnd;
    }
    
    // Check time slots in 30-minute increments
    let currentTime = poolOpenTime;
    const endTime = poolCloseTime;
    
    while (currentTime < endTime) {
      const proposedEnd = addMinutes(currentTime, durationMinutes);
      
      if (proposedEnd > endTime) break;
      
      // Check if this slot conflicts with any booking
      let hasConflict = false;
      for (const booking of bookedSlots) {
        const bookingStart = booking.start_time.slice(0, 5);
        const bookingEnd = booking.finish_time.slice(0, 5);
        
        if (
          (currentTime < bookingEnd && proposedEnd > bookingStart) ||
          (currentTime >= bookingStart && currentTime < bookingEnd)
        ) {
          hasConflict = true;
          break;
        }
      }
      
      if (!hasConflict) {
        suggestions.push({
          startTime: currentTime,
          finishTime: proposedEnd
        });
      }
      
      // Move to next 30-minute slot
      currentTime = addMinutes(currentTime, 30);
    }
    
    // Return up to 5 suggestions closest to preferred time
    suggestions.sort((a, b) => {
      const aDiff = Math.abs(timeToMinutes(a.startTime) - timeToMinutes(preferredStartTime));
      const bDiff = Math.abs(timeToMinutes(b.startTime) - timeToMinutes(preferredStartTime));
      return aDiff - bDiff;
    });
    
    return suggestions.slice(0, 5);
  } catch (error) {
    console.error('❌ Error suggesting available slots:', error);
    return [];
  }
}

// Helper function to convert time to minutes since midnight
function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Check if a specific time is available
 * @param {string} date - Booking date
 * @param {string} startTime - Start time
 * @param {string} finishTime - Finish time
 * @param {number|null} excludeBookingId - Booking ID to exclude
 * @returns {Promise<boolean>} True if available, false if conflict exists
 */
export async function isTimeSlotAvailable(date, startTime, finishTime, excludeBookingId = null) {
  const conflicts = await checkBookingConflicts(date, startTime, finishTime, excludeBookingId);
  return conflicts.length === 0;
}