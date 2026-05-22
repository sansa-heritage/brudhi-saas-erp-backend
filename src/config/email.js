const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async sendOTP(email, otp, name) {
    try {
      const mailOptions = {
        from: `"GasFlow ERP" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Password Reset OTP",
        text: `Dear ${name},\n\nYour OTP for password reset is: ${otp}\n\nThis OTP is valid for 10 minutes.\n\nIf you didn't request this, please ignore this email.\n\nRegards,\nGasFlow ERP Team`,
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`✅ OTP sent to ${email}`);
      return { success: true };
    } catch (error) {
      console.error("❌ Failed to send email:", error.message);
      return { success: false, error: error.message };
    }
  }

  async sendPasswordResetConfirmation(email, name) {
    try {
      const mailOptions = {
        from: `"GasFlow ERP" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Password Reset Successful",
        text: `Dear ${name},\n\nYour password has been successfully reset.\n\nYou can now login with your new password.\n\nRegards,\nGasFlow ERP Team`,
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Confirmation sent to ${email}`);
      return { success: true };
    } catch (error) {
      console.error("❌ Failed to send confirmation:", error.message);
      return { success: false };
    }
  }
}

module.exports = new EmailService();
