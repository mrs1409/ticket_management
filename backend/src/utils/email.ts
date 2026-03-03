import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  if (process.env.NODE_ENV === 'production' && process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Use Ethereal for development
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    console.log('[Email] Ethereal test account:', testAccount.user);
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<void> {
  try {
    const t = await getTransporter();
    const info = await t.sendMail({
      from: process.env.EMAIL_FROM || '"Ticket System" <noreply@ticketapp.com>',
      to,
      subject,
      text,
      html: html || text,
    });
    console.log('[Email] Sent:', info.messageId, nodemailer.getTestMessageUrl(info));
  } catch (err) {
    console.error('[Email] Failed to send:', err);
  }
}

export const emailTemplates = {
  ticketCreated: (customerName: string, ticketId: string, description: string) => ({
    subject: `Ticket #${ticketId.substring(0, 8)} Created`,
    text: `Hi ${customerName},\n\nYour support ticket has been created successfully.\nTicket ID: ${ticketId}\nDescription: ${description}\n\nOur team will respond shortly.\n\nThanks,\nSupport Team`,
  }),
  ticketAssigned: (agentName: string, ticketId: string) => ({
    subject: `New Ticket Assigned: #${ticketId.substring(0, 8)}`,
    text: `Hi ${agentName},\n\nA new ticket has been assigned to you.\nTicket ID: ${ticketId}\n\nPlease log in to review it.\n\nThanks,\nTicket System`,
  }),
  ticketResolved: (customerName: string, ticketId: string) => ({
    subject: `Ticket #${ticketId.substring(0, 8)} Resolved`,
    text: `Hi ${customerName},\n\nYour ticket #${ticketId} has been resolved.\n\nIf you have further questions, please open a new ticket.\n\nThanks,\nSupport Team`,
  }),
};
