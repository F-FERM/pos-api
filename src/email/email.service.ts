import * as dotenv from 'dotenv';
dotenv.config();
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { verificationEmailTemplate } from './templates/verification-email.template';
import { licenseIssuedEmailTemplate } from './templates/license-issued.template';
import { welcomeEmailTemplate } from './templates/welcome-email.template';
import { resetPasswordTemplate } from './templates/reset-password.template';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    try {
      const host =
        this.configService.get('MAIL_HOST') || 'smtp-relay.brevo.com';
      const port = parseInt(this.configService.get('MAIL_PORT') || '587', 10);
      const secure = this.configService.get('MAIL_SECURE') === 'true';
      const user = this.configService.get('MAIL_USER');
      const pass = this.configService.get('MAIL_PASS');

      if (!user || !pass) {
        this.logger.warn(
          'MAIL_USER or MAIL_PASS missing in .env. Email service will run in dev/log fallback mode.',
        );
        return;
      }

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
        pool: true,
        maxConnections: 5,
        rateDelta: 1000,
        rateLimit: 10,
        tls: {
          rejectUnauthorized: false,
        },
      });

      this.logger.log(`Email service initialized with Brevo SMTP (${host}:${port})`);

      this.transporter.verify((error) => {
        if (error) {
          this.logger.error(`SMTP connection failed: ${error.message}`);
        } else {
          this.logger.log('SMTP server is ready to send emails via Brevo');
        }
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to initialize email transporter: ${errorMessage}`,
      );
    }
  }

  /**
   * Send email with Brevo SMTP retry mechanism & fallback logging
   */
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    retries = 3,
  ): Promise<{ success: boolean; messageId?: string; message: string }> {
    const fromEmail =
      this.configService.get('MAIL_FROM') ||
      'POS Supermarket <support@pos-supermarket.app>';

    if (!this.transporter) {
      this.logger.warn(
        `[DEV MAIL FALLBACK] Sending Email to '${to}' | Subject: '${subject}'`,
      );
      return {
        success: true,
        message: 'Email logged in dev fallback mode',
      };
    }

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < retries) {
      try {
        attempt++;

        const info = await this.transporter.sendMail({
          from: fromEmail,
          to,
          subject,
          html,
        });

        this.logger.log(
          `Email sent successfully to ${to}, messageId: ${info.messageId}`,
        );

        return {
          success: true,
          messageId: info.messageId,
          message: 'Email sent successfully via Brevo SMTP',
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        lastError = error instanceof Error ? error : new Error('Unknown error');

        this.logger.warn(
          `Email attempt ${attempt}/${retries} failed for ${to}: ${errorMessage}`,
        );

        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    const finalError = lastError?.message || 'Unknown error';
    this.logger.error(
      `Failed to send email to ${to} after ${retries} attempts: ${finalError}`,
    );
    return {
      success: false,
      message: `Email sending failed: ${finalError}`,
    };
  }

  /**
   * Send verification OTP email
   */
  async sendVerificationOtp(
    to: string,
    name: string,
    otp: string,
  ): Promise<{ success: boolean; messageId?: string; message: string }> {
    try {
      const html = verificationEmailTemplate(name, otp);
      return await this.sendEmail(
        to,
        'Verify Your Store Registration Email - POS Supermarket',
        html,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send verification OTP to ${to}: ${errorMessage}`,
      );
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Send Store License Key email upon registration verification
   */
  async sendLicenseIssuedEmail(
    to: string,
    ownerName: string,
    companyName: string,
    licenseKey: string,
    maxCounters = 5,
    isTrial = false,
    expiresAtDate?: Date | null,
  ): Promise<{ success: boolean; messageId?: string; message: string }> {
    try {
      const html = licenseIssuedEmailTemplate(
        ownerName,
        companyName,
        licenseKey,
        maxCounters,
        isTrial,
        expiresAtDate,
      );
      const subject = isTrial
        ? `14-Day Free Trial License Key for ${companyName} - POS Supermarket`
        : `Your Store License Key for ${companyName} - POS Supermarket`;
      return await this.sendEmail(to, subject, html);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send license key email to ${to}: ${errorMessage}`,
      );
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(
    to: string,
    name: string,
    companyName: string,
  ): Promise<{ success: boolean; messageId?: string; message: string }> {
    try {
      const html = welcomeEmailTemplate(name, companyName);
      return await this.sendEmail(to, 'Welcome to POS Supermarket System! 🎉', html);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send welcome email to ${to}: ${errorMessage}`,
      );
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Send reset password OTP email
   */
  async sendResetPasswordOtp(
    to: string,
    name: string,
    otp: string,
  ): Promise<{ success: boolean; messageId?: string; message: string }> {
    try {
      const html = resetPasswordTemplate(name, otp);
      return await this.sendEmail(
        to,
        'Reset Your Password - POS Supermarket System',
        html,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send reset password OTP to ${to}: ${errorMessage}`,
      );
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Check Brevo SMTP email service health
   */
  async checkHealth(): Promise<{
    isHealthy: boolean;
    provider: string;
    message?: string;
  }> {
    try {
      if (!this.transporter) {
        return {
          isHealthy: false,
          provider: 'brevo',
          message: 'Email transporter not configured. Check MAIL_USER/MAIL_PASS in .env',
        };
      }

      await this.transporter.verify();

      return {
        isHealthy: true,
        provider: 'brevo',
        message: 'Brevo SMTP Email service is healthy and ready',
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        isHealthy: false,
        provider: 'brevo',
        message: errorMessage,
      };
    }
  }
}
