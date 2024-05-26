const nodemailer = require('nodemailer');
const config = require('./config');

// TODO: Add more transports (Slack, SMS, etc.) PR's welcome!

class AlertService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.auth.user,
        pass: config.smtp.auth.pass
      }
    });
  }

  /**
   * Send an alert email.
   * @param {string} message - The alert message to be sent.
   * @param {string} subject - The email subject.
   */
  sendAlertEmail(message, subject) {
    const mailOptions = {
      from: config.smtp.from,
      to: config.smtp.to,
      subject: subject,
      text: message
    };

    this.transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
      } else {
        console.log('Alert email sent:', info.response);
      }
    });
  }
}

module.exports = new AlertService();
