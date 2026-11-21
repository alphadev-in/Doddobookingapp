// Central email sender using IONOS SMTP (nodemailer) with styled responsive HTML templates.
import nodemailer from 'nodemailer';

let _transporter: nodemailer.Transporter | null = null;

export function getTransporter(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST || 'smtp.ionos.co.uk';
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || 'support@doddo.co.uk';
  const pass = process.env.SMTP_PASS;

  if (!pass) {
    console.info('[email:smtp-not-configured] SMTP_PASS is missing.');
    return null;
  }

  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // false for 587 (uses STARTTLS)
      auth: { user, pass },
      tls: {
        rejectUnauthorized: true,
      },
    });
  }
  return _transporter;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<boolean> {
  const transporter = getTransporter();
  const from = process.env.EMAIL_FROM || '"Doddo" <support@doddo.co.uk>';

  if (!transporter) {
    console.info(`[email:skipped-no-smtp] to=${to} subject="${subject}"`);
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      html,
    });
    console.info(`[email:sent] id=${info.messageId} to=${to} subject="${subject}"`);
    return true;
  } catch (err: any) {
    console.error(`[email:failed] to=${to} error=`, err?.message || err);
    return false;
  }
}

/** Base luxury responsive HTML wrapper for all Doddo emails */
export function emailLayout(content: string, preheader = ''): string {
  const siteUrl = (process.env.PUBLIC_SITE_URL || 'https://doddo.co.uk').replace(/\/+$/, '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Doddo</title>
  <!--[if mso]>
  <style type="text/css">
    table, td, div, p, a { font-family: Arial, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden; opacity: 0; mso-hide: all; font-size: 1px; line-height: 1px;">${preheader}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; width: 100%; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; width: 100%;">
          <!-- Header / Brand -->
          <tr>
            <td align="center" style="padding-bottom: 28px;">
              <a href="${siteUrl}" style="text-decoration: none; display: inline-block;">
                <span style="font-size: 26px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px;">Doddo</span>
                <span style="font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; margin-left: 6px;">Booking</span>
              </a>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04); overflow: hidden;">
                <tr>
                  <td style="padding: 36px 32px;">
                    ${content}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 32px; color: #94a3b8; font-size: 13px; line-height: 1.6;">
              <p style="margin: 0 0 8px;">Doddo Booking Platform · <a href="${siteUrl}" style="color: #6366f1; text-decoration: none; font-weight: 500;">doddo.co.uk</a></p>
              <p style="margin: 0;">Have a question? We're here to help at <a href="mailto:support@doddo.co.uk" style="color: #64748b; text-decoration: underline;">support@doddo.co.uk</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
