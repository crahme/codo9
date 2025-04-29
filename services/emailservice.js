const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const logger = require('pino')({ level: 'info' });

class EmailService {
  constructor(smtpServer, smtpPort, username, password) {
    this.smtpServer = smtpServer;
    this.smtpPort = smtpPort;
    this.username = username;
    this.password = password;

    // Configure the transporter
    this.transporter = nodemailer.createTransport({
      host: this.smtpServer,
      port: this.smtpPort,
      secure: this.smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: this.username,
        pass: this.password,
      },
    });
  }

  async sendInvoice(recipient, invoiceNumber, pdfPath) {
    /**
     * Send invoice email with PDF attachment
     */
    try {
      // Email body
      const message = {
        from: this.username,
        to: recipient,
        subject: `Invoice #${invoiceNumber}`,
        text: `
          Dear Customer,

          Please find attached your invoice #${invoiceNumber}.

          Thank you for your business.

          Best regards,
          RVE Team
        `,
        attachments: [
          {
            filename: `invoice_${invoiceNumber}.pdf`,
            path: pdfPath,
            contentType: 'application/pdf',
          },
        ],
      };

      // Send the email
      await this.transporter.sendMail(message);

      logger.info(`Invoice email sent successfully to ${recipient}`);
      return true;

    } catch (error) {
      logger.error(`Failed to send invoice email: ${error.message}`);
      return false;
    }
  }
}

module.exports = EmailService;
