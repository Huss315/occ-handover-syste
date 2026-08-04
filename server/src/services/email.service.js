const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendShiftReportEmail({ toEmails, subject, reportContent }) {
  if (!toEmails || toEmails.length === 0) {
    console.warn('No recipient emails provided — skipping email send.');
    return { sent: false, reason: 'No recipients' };
  }

  try {
    const result = await resend.emails.send({
      from: 'OCC Handover System <onboarding@resend.dev>',
      to: toEmails,
      subject,
      text: reportContent,
    });
    console.log('Resend API response:', JSON.stringify(result, null, 2));
    return { sent: true, result };
  } catch (err) {
    console.error('Email send failed:', err);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendShiftReportEmail };