export function resetPasswordTemplate(name: string, otp: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset Password OTP</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f6f9; padding: 20px; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 8px;">
    <h2 style="color: #dc2626;">Reset Your Password</h2>
    <p>Hi ${name},</p>
    <p>Use the 6-digit OTP code below to reset your POS account password:</p>
    <div style="font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #dc2626; margin: 20px 0;">${otp}</div>
    <p>This code is valid for 10 minutes. If you did not request a password reset, please ignore this email.</p>
  </div>
</body>
</html>
  `;
}
