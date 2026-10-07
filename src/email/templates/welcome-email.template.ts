export function welcomeEmailTemplate(
  name: string,
  companyName: string,
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to POS Supermarket System</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f6f9; padding: 20px; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 8px;">
    <h2 style="color: #1e3a8a;">Welcome to POS Supermarket System! 🎉</h2>
    <p>Hi ${name},</p>
    <p>We are thrilled to welcome <strong>${companyName}</strong> to our point-of-sale platform.</p>
    <p>Your store account is fully configured and ready for multi-counter checkout, inventory management, and receipt printing.</p>
    <br>
    <p>Best regards,<br>POS Support Team</p>
  </div>
</body>
</html>
  `;
}
