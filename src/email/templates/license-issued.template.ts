export function licenseIssuedEmailTemplate(
  ownerName: string,
  companyName: string,
  licenseKey: string,
  maxCounters: number,
  isTrial = false,
  expiresAtDate?: Date | null,
): string {
  const planTitle = isTrial
    ? '14-Day Free Trial License'
    : 'Professional Supermarket Retail Plan';
  const headerBg = isTrial
    ? 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)'
    : 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
  const badgeColor = isTrial ? '#1e3a8a' : '#047857';

  const expiryNotice = expiresAtDate
    ? `<p style="margin: 6px 0 0 0; font-size: 13px; color: #dc2626;"><strong>Trial Expires On:</strong> ${new Date(expiresAtDate).toLocaleDateString()}</p>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Store License Key Issued</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f9; color: #333333;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
    <!-- Header -->
    <tr>
      <td style="background: ${headerBg}; padding: 35px 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">Store License Key Issued 🎉</h1>
        <p style="color: #e0f2fe; margin: 8px 0 0 0; font-size: 14px;">Welcome to POS Supermarket Retail System</p>
      </td>
    </tr>
    <!-- Content -->
    <tr>
      <td style="padding: 40px 35px;">
        <h2 style="color: #1e293b; margin-top: 0; font-size: 20px;">Congratulations ${ownerName}!</h2>
        <p style="color: #475569; line-height: 1.6; font-size: 15px;">
          Your store <strong>${companyName}</strong> has been successfully registered. Below is your Store License Key to activate your Windows Desktop POS checkout counters:
        </p>
        <!-- License Box -->
        <div style="text-align: center; margin: 30px 0;">
          <div style="background-color: #f8fafc; border: 2px solid ${badgeColor}; padding: 22px 25px; border-radius: 10px; display: inline-block;">
            <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: ${badgeColor}; text-transform: uppercase; letter-spacing: 1px;">${planTitle}</p>
            <span style="font-family: monospace; font-size: 28px; font-weight: 800; color: #1e293b; letter-spacing: 3px;">${licenseKey}</span>
          </div>
        </div>
        <!-- Specs -->
        <div style="background-color: #f8fafc; border-left: 4px solid ${badgeColor}; padding: 15px 20px; border-radius: 0 8px 8px 0; margin-bottom: 25px;">
          <p style="margin: 0 0 6px 0; font-size: 14px; color: #334155;"><strong>Allowed Checkout Counters:</strong> ${maxCounters} Counters / PCs</p>
          <p style="margin: 0; font-size: 14px; color: #334155;"><strong>License Type:</strong> ${planTitle}</p>
          ${expiryNotice}
        </div>
        <h3 style="color: #1e293b; font-size: 16px; margin-bottom: 10px;">How to activate your POS Checkout Counters:</h3>
        <ol style="color: #475569; line-height: 1.8; font-size: 14px; padding-left: 20px;">
          <li>Install the POS Windows Desktop App on your physical counter PCs.</li>
          <li>Enter your Store License Key (<strong>${licenseKey}</strong>) and Counter Name.</li>
          <li>Once activated, the app will auto-bypass setup forms and jump directly to Staff PIN Login!</li>
        </ol>
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
