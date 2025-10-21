import { pool } from '../db.js';
import { sendBookingReminder } from '../utils/mailjetService.js';

async function sendReminders() {
  console.log('🔔 Running booking reminder check...');
  
  try {
    // Get all approved bookings that are tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const query = `
      SELECT * FROM pool_bookings 
      WHERE status = 'approved' 
      AND date = $1
      ORDER BY start_time
    `;
    
    const result = await pool.query(query, [tomorrow.toISOString().split('T')[0]]);
    
    if (result.rows.length === 0) {
      console.log('✅ No bookings tomorrow - no reminders to send');
      return;
    }
    
    console.log(`📧 Found ${result.rows.length} booking(s) tomorrow, sending reminders...`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const booking of result.rows) {
      try {
        await sendBookingReminder(booking);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to send reminder for booking #${booking.id}:`, error.message);
        failCount++;
      }
    }
    
    console.log(`✅ Reminder summary: ${successCount} sent, ${failCount} failed`);
    
  } catch (error) {
    console.error('❌ Error in reminder script:', error);
  }
}

// Run the script
sendReminders()
  .then(() => {
    console.log('🎉 Reminder script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });