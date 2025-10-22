import Mailjet from 'node-mailjet';

// Initialize Mailjet
const mailjet = new Mailjet({
  apiKey: process.env.MAILJET_API_KEY,
  apiSecret: process.env.MAILJET_SECRET_KEY
});

// Verify configuration
if (process.env.MAILJET_API_KEY && process.env.MAILJET_SECRET_KEY) {
  console.log('✅ Mailjet is configured');
} else {
  console.warn('⚠️ MAILJET_API_KEY or MAILJET_SECRET_KEY not found in environment variables');
}

// Format date nicely
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Format time nicely
function formatTime(time) {
  if (!time) return '';
  const [h, m] = time.split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

// Common email footer - Professional for school systems
const emailFooter = `
  <div class="footer">
    <p style="margin: 0; color: #6b7280;">Pymble Ladies College - Pool Booking System</p>
    <p style="margin: 5px 0 0 0; color: #9ca3af; font-size: 12px;">This is an automated notification. Please do not reply to this email.</p>
    <p style="margin: 5px 0 0 0; color: #9ca3af; font-size: 12px;">For support, contact your pool administrator.</p>
    <hr style="border: none; border-top: 1px solid #555; margin: 15px 0;">
    <p style="margin: 5px 0; font-size: 11px; color: #999;">
      Pool Booking System | Pymble Ladies College<br>
      Avon Road, Pymble NSW 2073<br>
      © ${new Date().getFullYear()} All rights reserved
    </p>
  </div>
`;

// Common styles
const emailStyles = `
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
    .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .detail-row { display: flex; padding: 10px 0; border-bottom: 1px solid #eee; }
    .detail-label { font-weight: bold; width: 150px; color: #667eea; }
    .detail-value { flex: 1; }
    .footer { background: #333; color: white; padding: 20px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px; }
    .success-badge { background: #28a745; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; }
    .pending-badge { background: #ffc107; color: #333; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; }
    .rejected-badge { background: #dc3545; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; }
    .important-notice { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .info-box { background: #e7f3ff; border-left: 4px solid #0066cc; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .success-box { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .feedback-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .action-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .recovery-code { background: #f8f9fa; border: 2px dashed #667eea; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; }
    .code-text { font-size: 28px; font-weight: bold; color: #667eea; letter-spacing: 2px; font-family: 'Courier New', monospace; }
  </style>
`;

// Helper function to send email via Mailjet
async function sendEmail(to, subject, html, text) {
  try {
    const fromEmail = process.env.MAILJET_FROM_EMAIL || 'noreply@yourdomain.com';
    const replyToEmail = process.env.MAILJET_REPLY_TO || fromEmail;
    
    console.log(`📧 Attempting to send email to: ${to}`);
    console.log(`📧 From: ${fromEmail}`);
    console.log(`📧 Subject: ${subject}`);
    
    const request = await mailjet
      .post('send', { version: 'v3.1' })
      .request({
        Messages: [
          {
            From: {
              Email: fromEmail,
              Name: 'PLC Pool Booking System'
            },
            To: [
              {
                Email: to
              }
            ],
            Subject: subject,
            TextPart: text,
            HTMLPart: html,
            CustomID: `poolbooking-${Date.now()}`,
            ReplyTo: {
              Email: replyToEmail,
              Name: 'Pool Management Team'
            }
          }
        ]
      });

    console.log(`✅ Email sent to ${to}: ${subject}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Mailjet error:', error.statusCode);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error details:', JSON.stringify(error.response?.body || error, null, 2));
    return { success: false, error: error.message };
  }
}

// 1. Registration Confirmation
export async function sendRegistrationConfirmation(user) {
  const subject = 'Pool Booking System - Account Created Successfully';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>${emailStyles}</head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Pool Booking System</h1>
          <p style="margin: 0; font-size: 18px;">Your account has been created successfully</p>
        </div>
        <div class="content">
          <p>Dear ${user.full_name || user.username},</p>
          <p>Welcome to the Pool Booking System! Your account has been successfully created.</p>
          
          <div class="booking-details">
            <h2 style="color: #667eea; margin-top: 0;">Account Details</h2>
            <div class="detail-row">
              <div class="detail-label">Username:</div>
              <div class="detail-value"><strong>${user.username}</strong></div>
            </div>
            ${user.full_name ? `
            <div class="detail-row">
              <div class="detail-label">Full Name:</div>
              <div class="detail-value">${user.full_name}</div>
            </div>
            ` : ''}
          </div>
          
          <div class="recovery-code">
            <h3 style="color: #667eea; margin-top: 0;">Your Recovery Code</h3>
            <p style="margin: 10px 0;">Save this code in a safe place. You'll need it to recover your account if you forget your password.</p>
            <div class="code-text">${user.recovery_code}</div>
          </div>
          
          <div class="important-notice">
            <strong>Important:</strong>
            <ul style="margin: 10px 0;">
              <li>Keep your recovery code secure and private</li>
              <li>Do not share your recovery code with anyone</li>
              <li>You'll need this code if you ever forget your password</li>
            </ul>
          </div>
          
          <div class="success-box">
            <strong>You can now:</strong>
            <ul style="margin: 10px 0;">
              <li>Create pool booking requests</li>
              <li>View your booking history</li>
              <li>Edit and resubmit rejected bookings</li>
            </ul>
          </div>
          
          <div style="text-align: center;">
            <a href="${process.env.APP_URL || 'http://localhost:3000'}/login" class="action-button">Login to Your Account</a>
          </div>
          
          <p>Best regards,<br><strong>Pool Management Team</strong></p>
        </div>
        ${emailFooter}
      </div>
    </body>
    </html>
  `;

  const text = `POOL BOOKING SYSTEM - ACCOUNT CREATED

Dear ${user.full_name || user.username},

Your account has been successfully created!

Recovery Code: ${user.recovery_code}

IMPORTANT: Save this recovery code. You'll need it to recover your account if you forget your password.

Login at: ${process.env.APP_URL}/login

Best regards,
Pool Management Team
Pymble Ladies College`;

  return await sendEmail(user.email || `${user.username}@example.com`, subject, html, text);
}

// 2. Booking Submitted
export async function sendBookingSubmitted(booking) {
  const formattedDate = formatDate(booking.date);
  const subject = `Pool Booking - Submitted for Approval - ${formattedDate}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>${emailStyles}</head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Booking Submitted</h1>
          <p style="margin: 0; font-size: 18px;">Your booking request has been received</p>
        </div>
        <div class="content">
          <p>Dear ${booking.requester},</p>
          <p>Thank you for submitting your pool booking request. Your booking is now <span class="pending-badge">PENDING APPROVAL</span></p>
          
          <div class="booking-details">
            <h2 style="color: #667eea; margin-top: 0;">Booking Details</h2>
            <div class="detail-row">
              <div class="detail-label">Booking ID:</div>
              <div class="detail-value"><strong>#${booking.id}</strong></div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Date:</div>
              <div class="detail-value">${formattedDate}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Time:</div>
              <div class="detail-value">${formatTime(booking.start_time)} - ${formatTime(booking.finish_time)}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Type:</div>
              <div class="detail-value">${booking.type_of_use}</div>
            </div>
            ${booking.event_name ? `
            <div class="detail-row">
              <div class="detail-label">Event:</div>
              <div class="detail-value">${booking.event_name}</div>
            </div>
            ` : ''}
          </div>
          
          <div class="info-box">
            <strong>What happens next?</strong>
            <p style="margin: 10px 0 0 0;">Our team will review your booking request and you'll receive an email notification once it has been approved or if any changes are needed.</p>
          </div>
          
          <div style="text-align: center;">
            <a href="${process.env.APP_URL}/my-bookings" class="action-button">View Your Bookings</a>
          </div>
          
          <p>Best regards,<br><strong>Pool Management Team</strong></p>
        </div>
        ${emailFooter}
      </div>
    </body>
    </html>
  `;

  const text = `POOL BOOKING SUBMITTED

Dear ${booking.requester},

Your pool booking request has been received and is PENDING APPROVAL.

Booking Details:
- Booking ID: #${booking.id}
- Date: ${formattedDate}
- Time: ${formatTime(booking.start_time)} - ${formatTime(booking.finish_time)}

Our team will review your request and notify you once approved.

View bookings: ${process.env.APP_URL}/my-bookings

Best regards,
Pool Management Team
Pymble Ladies College`;

  return await sendEmail(booking.email, subject, html, text);
}

// 3. Booking Approved
export async function sendBookingApproved(booking) {
  const formattedDate = formatDate(booking.date);
  const subject = `Pool Booking - Approved - ${formattedDate}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>${emailStyles}</head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Booking Approved</h1>
          <p style="margin: 0; font-size: 18px;">Your pool booking request has been approved</p>
        </div>
        <div class="content">
          <p>Dear ${booking.requester},</p>
          <p>Great news! Your pool booking request has been <span class="success-badge">APPROVED</span></p>
          
          <div class="booking-details">
            <h2 style="color: #667eea; margin-top: 0;">Booking Details</h2>
            <div class="detail-row">
              <div class="detail-label">Booking ID:</div>
              <div class="detail-value">#${booking.id}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Date:</div>
              <div class="detail-value">${formattedDate}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Time:</div>
              <div class="detail-value">${formatTime(booking.start_time)} - ${formatTime(booking.finish_time)}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Type:</div>
              <div class="detail-value">${booking.type_of_use}</div>
            </div>
            ${booking.event_name ? `
            <div class="detail-row">
              <div class="detail-label">Event:</div>
              <div class="detail-value">${booking.event_name}</div>
            </div>
            ` : ''}
            ${booking.participants ? `
            <div class="detail-row">
              <div class="detail-label">Participants:</div>
              <div class="detail-value">${booking.participants}</div>
            </div>
            ` : ''}
          </div>
          
          ${booking.feedback ? `
          <div class="important-notice">
            <strong>Admin Notes:</strong><br>
            ${booking.feedback}
          </div>
          ` : ''}
          
          <div class="important-notice">
            <strong>Important Reminders:</strong>
            <ul style="margin: 10px 0;">
              <li>Please arrive 10 minutes before your scheduled time</li>
              <li>Ensure all safety equipment is available</li>
              <li>Contact the pool manager if you need to make any changes</li>
              <li>You'll receive a reminder email 24 hours before your booking</li>
            </ul>
          </div>
          
          <p>Best regards,<br><strong>Pool Management Team</strong></p>
        </div>
        ${emailFooter}
      </div>
    </body>
    </html>
  `;

  const text = `POOL BOOKING APPROVED

Dear ${booking.requester},

Your pool booking request has been APPROVED!

Booking Details:
- Booking ID: #${booking.id}
- Date: ${formattedDate}
- Time: ${formatTime(booking.start_time)} - ${formatTime(booking.finish_time)}

${booking.feedback ? `Admin Notes: ${booking.feedback}` : ''}

Important Reminders:
- Arrive 10 minutes before your scheduled time
- Ensure all safety equipment is available
- You'll receive a reminder 24 hours before

Best regards,
Pool Management Team
Pymble Ladies College`;

  return await sendEmail(booking.email, subject, html, text);
}

// 4. Booking Rejected
export async function sendBookingRejected(booking) {
  const formattedDate = formatDate(booking.date);
  const subject = `Pool Booking - Rejected - ${formattedDate}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      ${emailStyles}
      <style>.header.rejected { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); }</style>
    </head>
    <body>
      <div class="container">
        <div class="header rejected">
          <h1>Booking Status Update</h1>
          <p style="margin: 0; font-size: 18px;">Your pool booking request requires attention</p>
        </div>
        <div class="content">
          <p>Dear ${booking.requester},</p>
          <p>We regret to inform you that your pool booking request has been <span class="rejected-badge">REJECTED</span></p>
          
          <div class="booking-details">
            <h2 style="color: #dc3545; margin-top: 0;">Booking Details</h2>
            <div class="detail-row">
              <div class="detail-label">Booking ID:</div>
              <div class="detail-value">#${booking.id}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Date:</div>
              <div class="detail-value">${formattedDate}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Time:</div>
              <div class="detail-value">${formatTime(booking.start_time)} - ${formatTime(booking.finish_time)}</div>
            </div>
          </div>
          
          ${booking.feedback ? `
          <div class="feedback-box">
            <strong>Reason for Rejection:</strong><br>
            <p style="margin: 10px 0 0 0;">${booking.feedback}</p>
          </div>
          ` : ''}
          
          <div class="info-box">
            <strong>What's Next?</strong>
            <p style="margin: 10px 0 0 0;">You can edit your booking and resubmit it with the necessary changes. Please review the feedback above and make the required adjustments.</p>
          </div>
          
          <div style="text-align: center;">
            <a href="${process.env.APP_URL}/my-bookings" class="action-button">View & Edit Your Bookings</a>
          </div>
          
          <p>If you have any questions about the rejection, please contact us for clarification.</p>
          
          <p>Best regards,<br><strong>Pool Management Team</strong></p>
        </div>
        ${emailFooter}
      </div>
    </body>
    </html>
  `;

  const text = `POOL BOOKING REJECTED

Dear ${booking.requester},

Your pool booking request has been REJECTED.

Booking Details:
- Booking ID: #${booking.id}
- Date: ${formattedDate}
- Time: ${formatTime(booking.start_time)} - ${formatTime(booking.finish_time)}

${booking.feedback ? `Reason: ${booking.feedback}` : ''}

You can edit and resubmit your booking at: ${process.env.APP_URL}/my-bookings

Best regards,
Pool Management Team
Pymble Ladies College`;

  return await sendEmail(booking.email, subject, html, text);
}

// 5. Booking Cancelled
export async function sendBookingCancelled(booking) {
  const formattedDate = formatDate(booking.date);
  const subject = `Pool Booking - Cancelled - ${formattedDate}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>${emailStyles}</head>
    <body>
      <div class="container">
        <div class="header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
          <h1>Booking Cancelled</h1>
          <p style="margin: 0; font-size: 18px;">Your pool booking has been cancelled</p>
        </div>
        <div class="content">
          <p>Dear ${booking.requester},</p>
          <p>This email confirms that your pool booking has been cancelled.</p>
          
          <div class="booking-details">
            <h2 style="color: #f59e0b; margin-top: 0;">Cancelled Booking Details</h2>
            <div class="detail-row">
              <div class="detail-label">Booking ID:</div>
              <div class="detail-value">#${booking.id}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Date:</div>
              <div class="detail-value">${formattedDate}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Time:</div>
              <div class="detail-value">${formatTime(booking.start_time)} - ${formatTime(booking.finish_time)}</div>
            </div>
          </div>
          
          ${booking.feedback ? `
          <div class="important-notice">
            <strong>Cancellation Note:</strong><br>
            ${booking.feedback}
          </div>
          ` : ''}
          
          <div class="info-box">
            <strong>Need to Book Again?</strong>
            <p style="margin: 10px 0 0 0;">You can create a new booking request at any time through the pool booking system.</p>
          </div>
          
          <div style="text-align: center;">
            <a href="${process.env.APP_URL}/my-bookings" class="action-button">View Your Bookings</a>
          </div>
          
          <p>Best regards,<br><strong>Pool Management Team</strong></p>
        </div>
        ${emailFooter}
      </div>
    </body>
    </html>
  `;

  const text = `POOL BOOKING CANCELLED

Dear ${booking.requester},

Your pool booking has been cancelled.

Booking Details:
- Booking ID: #${booking.id}
- Date: ${formattedDate}
- Time: ${formatTime(booking.start_time)} - ${formatTime(booking.finish_time)}

${booking.feedback ? `Note: ${booking.feedback}` : ''}

You can create a new booking at: ${process.env.APP_URL}/my-bookings

Best regards,
Pool Management Team
Pymble Ladies College`;

  return await sendEmail(booking.email, subject, html, text);
}

// 6. Booking Reminder (24 hours before)
export async function sendBookingReminder(booking) {
  const formattedDate = formatDate(booking.date);
  const subject = `Pool Booking - Reminder - Tomorrow ${formattedDate}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>${emailStyles}</head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Booking Reminder</h1>
          <p style="margin: 0; font-size: 18px;">Your pool booking is tomorrow</p>
        </div>
        <div class="content">
          <p>Dear ${booking.requester},</p>
          <p>This is a friendly reminder that you have a pool booking scheduled for <strong>tomorrow</strong>.</p>
          
          <div class="booking-details">
            <h2 style="color: #667eea; margin-top: 0;">Booking Details</h2>
            <div class="detail-row">
              <div class="detail-label">Booking ID:</div>
              <div class="detail-value"><strong>#${booking.id}</strong></div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Date:</div>
              <div class="detail-value"><strong>${formattedDate}</strong></div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Time:</div>
              <div class="detail-value"><strong>${formatTime(booking.start_time)} - ${formatTime(booking.finish_time)}</strong></div>
            </div>
            ${booking.event_name ? `
            <div class="detail-row">
              <div class="detail-label">Event:</div>
              <div class="detail-value">${booking.event_name}</div>
            </div>
            ` : ''}
            ${booking.participants ? `
            <div class="detail-row">
              <div class="detail-label">Participants:</div>
              <div class="detail-value">${booking.participants}</div>
            </div>
            ` : ''}
          </div>
          
          <div class="important-notice">
            <strong>Pre-Booking Checklist:</strong>
            <ul style="margin: 10px 0;">
              <li>Arrive 10-15 minutes before your scheduled time</li>
              <li>Ensure all required equipment is available and in good condition</li>
              <li>Confirm all participants and supervisors are aware of the booking</li>
              <li>Review safety procedures and emergency protocols</li>
              ${booking.risk_file ? '<li>Bring your risk assessment documentation</li>' : ''}
            </ul>
          </div>
          
          <div class="info-box">
            <strong>Need to Make Changes?</strong>
            <p style="margin: 10px 0 0 0;">If you need to modify or cancel this booking, please contact the pool management team as soon as possible.</p>
          </div>
          
          <div style="text-align: center;">
            <a href="${process.env.APP_URL}/my-bookings" class="action-button">View Booking Details</a>
          </div>
          
          <p>We look forward to seeing you tomorrow!</p>
          
          <p>Best regards,<br><strong>Pool Management Team</strong></p>
        </div>
        ${emailFooter}
      </div>
    </body>
    </html>
  `;

  const text = `POOL BOOKING REMINDER - TOMORROW

Dear ${booking.requester},

Your pool booking is scheduled for TOMORROW.

Booking Details:
- Booking ID: #${booking.id}
- Date: ${formattedDate}
- Time: ${formatTime(booking.start_time)} - ${formatTime(booking.finish_time)}

Pre-Booking Checklist:
- Arrive 10-15 minutes early
- Ensure all equipment is ready
- Confirm participants and supervisors
- Review safety procedures

View booking: ${process.env.APP_URL}/my-bookings

See you tomorrow!

Best regards,
Pool Management Team
Pymble Ladies College`;

  return await sendEmail(booking.email, subject, html, text);
}
// 7. Admin Notification - New Booking Submitted
export async function sendAdminBookingNotification(booking, adminEmail) {
  const formattedDate = formatDate(booking.date);
  const subject = `New Pool Booking Request - ${booking.requester} - ${formattedDate}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>${emailStyles}</head>
    <body>
      <div class="container">
        <div class="header" style="background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);">
          <h1>New Booking Request</h1>
          <p style="margin: 0; font-size: 18px;">A new pool booking requires your approval</p>
        </div>
        <div class="content">
          <p>Dear Admin,</p>
          <p>A new pool booking request has been submitted and is <span class="pending-badge">PENDING APPROVAL</span></p>
          
          <div class="booking-details">
            <h2 style="color: #ff9800; margin-top: 0;">Booking Details</h2>
            <div class="detail-row">
              <div class="detail-label">Booking ID:</div>
              <div class="detail-value"><strong>#${booking.id}</strong></div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Requester:</div>
              <div class="detail-value"><strong>${booking.requester}</strong></div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Email:</div>
              <div class="detail-value">${booking.email}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Date:</div>
              <div class="detail-value">${formattedDate}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Time:</div>
              <div class="detail-value">${formatTime(booking.start_time)} - ${formatTime(booking.finish_time)}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Type:</div>
              <div class="detail-value">${booking.type_of_use}</div>
            </div>
            ${booking.event_name ? `
            <div class="detail-row">
              <div class="detail-label">Event:</div>
              <div class="detail-value">${booking.event_name}</div>
            </div>
            ` : ''}
            ${booking.participants ? `
            <div class="detail-row">
              <div class="detail-label">Participants:</div>
              <div class="detail-value">${booking.participants}</div>
            </div>
            ` : ''}
            ${booking.description ? `
            <div class="detail-row">
              <div class="detail-label">Description:</div>
              <div class="detail-value">${booking.description}</div>
            </div>
            ` : ''}
            ${booking.risk_file ? `
            <div class="detail-row">
              <div class="detail-label">Risk Assessment:</div>
              <div class="detail-value">Uploaded ✓</div>
            </div>
            ` : ''}
          </div>
          
          <div class="important-notice">
            <strong>Action Required:</strong>
            <p style="margin: 10px 0 0 0;">Please review this booking request and either approve or reject it. The requester is waiting for your response.</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL}/admin/bookings" class="action-button" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%);">Review & Approve Booking</a>
          </div>
          
          <p>You can manage this booking from the admin dashboard.</p>
          
          <p>Best regards,<br><strong>Pool Booking System</strong></p>
        </div>
        ${emailFooter}
      </div>
    </body>
    </html>
  `;

  const text = `NEW POOL BOOKING REQUEST

A new pool booking requires your approval.

Booking Details:
- Booking ID: #${booking.id}
- Requester: ${booking.requester}
- Email: ${booking.email}
- Date: ${formattedDate}
- Time: ${formatTime(booking.start_time)} - ${formatTime(booking.finish_time)}
- Type: ${booking.type_of_use}
${booking.event_name ? `- Event: ${booking.event_name}` : ''}
${booking.participants ? `- Participants: ${booking.participants}` : ''}

Action Required: Please review and approve/reject this booking.

Review booking: ${process.env.APP_URL}/admin/bookings

Best regards,
Pool Booking System
Pymble Ladies College`;

  return await sendEmail(adminEmail, subject, html, text);
}