// utils/reminderScheduler.js
import cron from 'node-cron';
import { pool } from '../db.js';
import { sendBookingReminder } from './mailjetService.js';

// Schedule reminder check to run every day at 9:00 AM Sydney time
export function startReminderScheduler() {
  // Cron format: minute hour day month weekday
  // '0 9 * * *' = Every day at 9:00 AM
  // Note: Render uses UTC, so we need to adjust for Sydney time
  // Sydney is UTC+10 (or UTC+11 during daylight saving)
  // To run at 9 AM Sydney time, we run at 11 PM UTC (previous day)
  const cronTime = '0 23 * * *'; // 11 PM UTC = 9 AM Sydney (UTC+10)
  
  cron.schedule(cronTime, async () => {
    console.log('🔔 Running daily booking reminder check...');
    await runReminderCheck();
  }, {
    timezone: "UTC" // Run in UTC, we'll handle Sydney time in the query
  });
  
  console.log('✅ Booking reminder scheduler started');
  console.log('📅 Will run daily at 9:00 AM Sydney time');
  console.log('⏰ Next run will check for bookings happening tomorrow');
}

// Main reminder check function
async function runReminderCheck() {
  try {
    // Calculate tomorrow's date in Sydney timezone
    const now = new Date();
    const sydneyOffset = 10; // UTC+10 (adjust to +11 during daylight saving if needed)
    const sydneyTime = new Date(now.getTime() + (sydneyOffset * 60 * 60 * 1000));
    
    const tomorrow = new Date(sydneyTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];
    
    console.log(`📅 Checking for bookings on: ${tomorrowDate}`);
    
    // Get all approved bookings for tomorrow that haven't received reminders
    const result = await pool.query(
      `SELECT * FROM pool_bookings 
       WHERE date = $1 
       AND status = 'approved'
       AND (reminder_sent = false OR reminder_sent IS NULL)
       ORDER BY start_time`,
      [tomorrowDate]
    );
    
    console.log(`📧 Found ${result.rows.length} booking(s) needing reminders`);
    
    if (result.rows.length === 0) {
      console.log('✅ No reminders to send today');
      return;
    }
    
    // Send reminders
    let successCount = 0;
    let failCount = 0;
    
    for (const booking of result.rows) {
      try {
        console.log(`📤 Sending reminder for booking #${booking.id} to ${booking.email}`);
        await sendBookingReminder(booking);
        
        // Mark reminder as sent
        await pool.query(
          'UPDATE pool_bookings SET reminder_sent = true WHERE id = $1',
          [booking.id]
        );
        
        console.log(`✅ Reminder sent for booking #${booking.id} (${booking.requester})`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to send reminder for booking #${booking.id}:`, error.message);
        failCount++;
      }
    }
    
    console.log('━'.repeat(60));
    console.log('📊 Reminder Summary:');
    console.log(`   ✅ Sent successfully: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log('━'.repeat(60));
    
  } catch (error) {
    console.error('❌ Error running reminder scheduler:', error);
  }
}

// Manual trigger for testing (call this from routes or directly)
export async function sendRemindersNow() {
  console.log('🔔 MANUAL TRIGGER: Running reminder check now...');
  await runReminderCheck();
}

// Test function to see what would be sent (without actually sending)
export async function previewTomorrowReminders() {
  try {
    const now = new Date();
    const sydneyOffset = 10;
    const sydneyTime = new Date(now.getTime() + (sydneyOffset * 60 * 60 * 1000));
    
    const tomorrow = new Date(sydneyTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];
    
    const result = await pool.query(
      `SELECT id, requester, email, date, start_time, finish_time, reminder_sent 
       FROM pool_bookings 
       WHERE date = $1 
       AND status = 'approved'
       ORDER BY start_time`,
      [tomorrowDate]
    );
    
    console.log('\n📋 PREVIEW: Bookings for tomorrow that need reminders:');
    console.log('━'.repeat(60));
    
    if (result.rows.length === 0) {
      console.log('   No bookings scheduled for tomorrow');
    } else {
      result.rows.forEach(booking => {
        const needsReminder = !booking.reminder_sent ? '📧 WILL SEND' : '✅ Already sent';
        console.log(`   #${booking.id} - ${booking.requester} (${booking.email})`);
        console.log(`   Time: ${booking.start_time.slice(0,5)} - ${booking.finish_time.slice(0,5)}`);
        console.log(`   Status: ${needsReminder}`);
        console.log('   ' + '─'.repeat(56));
      });
    }
    
    console.log('━'.repeat(60));
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error previewing reminders:', error);
    return [];
  }
}