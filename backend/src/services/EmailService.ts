import nodemailer from 'nodemailer';

export class EmailService {
  private isConfigured(): boolean {
    return Boolean(
      process.env.SMTP_HOST &&
        process.env.SMTP_PORT &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS &&
        process.env.SMTP_FROM
    );
  }

  async sendPasswordResetEmail(recipient: string, resetUrl: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    const host = process.env.SMTP_HOST as string;
    const port = Number(process.env.SMTP_PORT);
    const user = process.env.SMTP_USER as string;
    const pass = process.env.SMTP_PASS as string;
    const from = process.env.SMTP_FROM as string;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

    await transporter.sendMail({
      from,
      to: recipient,
      subject: 'Redefinição de senha - Meta Ads AI Manager',
      text: `Você solicitou redefinição de senha. Acesse o link: ${resetUrl}`,
      html: `
        <p>Você solicitou redefinição de senha.</p>
        <p>Clique no link abaixo para continuar:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Se você não solicitou, ignore este email.</p>
      `,
    });

    return true;
  }
}

export default new EmailService();
