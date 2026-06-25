import { getIngressoDbPool } from "@/lib/ingresso-db";

type QueueLegacyEmailInput = {
  to: string;
  toName: string | null;
  subject: string;
  html: string;
};

type EmailQueueRow = {
  idemail: number;
};

function getLegacyEmailConfig() {
  return {
    host: process.env.EMAIL_SMTP_SERVER?.trim() || "smtp.zoho.com",
    port: Number(process.env.EMAIL_SMTP_PORT ?? 465),
    secure:
      String(process.env.EMAIL_SMTP_SSL ?? "SSL").trim().toUpperCase() === "SSL",
    username: process.env.EMAIL_SMTP_USERNAME?.trim() || "",
    password: process.env.EMAIL_SMTP_PASSWORD?.trim() || "",
    fromEmail:
      process.env.EMAIL_FROM_ADDRESS?.trim() || "ingressos@estancia.local",
    fromName: process.env.EMAIL_FROM_NAME?.trim() || "Estancia",
    replyToEmail:
      process.env.EMAIL_REPLYTO_ADDRESS?.trim() || "ingressos@estancia.local",
    sendSync: String(process.env.PASSWORD_RESET_SEND_SYNC ?? "1").trim() === "1",
    maxRetries: Number(process.env.EMAIL_MAX_RETRIES ?? 1),
  };
}

function isSmtpConfigured() {
  const config = getLegacyEmailConfig();
  return Boolean(config.host && config.username && config.password);
}

async function sendQueuedEmail(idemail: number, input: QueueLegacyEmailInput) {
  const config = getLegacyEmailConfig();

  if (!config.sendSync || !isSmtpConfigured()) {
    return;
  }

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.username,
      pass: config.password,
    },
  });

  try {
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: input.toName ? `"${input.toName}" <${input.to}>` : input.to,
      replyTo: config.replyToEmail,
      subject: input.subject,
      html: input.html,
    });

    await getIngressoDbPool().query(
      `
        UPDATE email
        SET stemail = 'env',
            dtenv = CURRENT_DATE,
            hrenv = CURRENT_TIME
        WHERE idemail = $1
      `,
      [idemail],
    );
  } catch (error) {
    console.error("legacy-email-send-failed", error);

    await getIngressoDbPool().query(
      `
        UPDATE email
        SET erros = COALESCE(erros, 0) + 1,
            stemail = CASE
              WHEN COALESCE(erros, 0) + 1 > $2 THEN 'fal'
              ELSE stemail
            END
        WHERE idemail = $1
      `,
      [idemail, Math.max(0, config.maxRetries)],
    );
  }
}

export async function queueLegacyEmail(input: QueueLegacyEmailInput) {
  const pool = getIngressoDbPool();
  const config = getLegacyEmailConfig();
  const result = await pool.query<EmailQueueRow>(
    `
      INSERT INTO email (
        dtemail,
        hremail,
        stemail,
        erros,
        resppara,
        de,
        nomede,
        para,
        nomepara,
        assunto,
        conteudo
      )
      VALUES (
        CURRENT_DATE,
        CURRENT_TIME,
        'nov',
        0,
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7
      )
      RETURNING idemail
    `,
    [
      config.replyToEmail,
      config.fromEmail,
      config.fromName,
      input.to,
      input.toName,
      input.subject,
      input.html,
    ],
  );
  const idemail = result.rows[0]?.idemail;

  if (idemail) {
    await sendQueuedEmail(idemail, input);
  }

  return idemail ?? null;
}
