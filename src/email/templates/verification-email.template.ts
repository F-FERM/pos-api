export function verificationEmailTemplate(
  name: string,
  otp: string,
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Verification</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f9; color: #333333;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 35px 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">POS Supermarket Retail</h1>
        <p style="color: #e0f2fe; margin: 8px 0 0 0; font-size: 14px;">Store Account Registration & Email Verification</p>
      </td>
    </tr>
    <!-- Content -->
    <tr>
      <td style="padding: 40px 35px;">
        <h2 style="color: #1e293b; margin-top: 0; font-size: 20px;">Hello ${name},</h2>
        <p style="color: #475569; line-height: 1.6; font-size: 15px;">
          Thank you for registering your retail supermarket account. Please use the 6-digit email verification code below to complete your registration setup:
        </p>
        <!-- OTP Box -->
        <div style="text-align: center; margin: 35px 0;">
          <div style="display: inline-block; background-color: #f8fafc; border: 2px dashed #3b82f6; padding: 18px 36px; border-radius: 10px;">
            <span style="font-family: monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a;">${otp}</span>
          </div>
          <p style="color: #64748b; font-size: 13px; margin-top: 12px;">This code is valid for <strong>10 minutes</strong>. Do not share this code with anyone.</p>
        </div>
        <p style="color: #475569; line-height: 1.6; font-size: 14px;">
          If you did not initiate this store registration request, you can safely ignore this email.
        </p>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
        &copy; ${new Date().getFullYear()} POS Supermarket System. All rights reserved.
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
