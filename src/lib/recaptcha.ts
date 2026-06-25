type RecaptchaResponse = {
  success?: boolean;
  score?: number;
  action?: string;
  "error-codes"?: string[];
};

const DEFAULT_RECAPTCHA_MIN_SCORE = 0.5;

export function getRecaptchaSiteKey() {
  return (
    process.env.RECAPTCHA_PUBLIC_KEY?.trim() ||
    process.env.INGRESSO_RECAPTCHA_PUBLIC_KEY?.trim() ||
    ""
  );
}

function getRecaptchaSecretKey() {
  return (
    process.env.RECAPTCHA_SECRET_KEY?.trim() ||
    process.env.INGRESSO_RECAPTCHA_SECRET_KEY?.trim() ||
    ""
  );
}

export function isRecaptchaEnabled() {
  return Boolean(getRecaptchaSiteKey() && getRecaptchaSecretKey());
}

function getRecaptchaMinScore() {
  const configured = Number(
    process.env.INGRESSO_RECAPTCHA_MIN_SCORE ?? DEFAULT_RECAPTCHA_MIN_SCORE,
  );

  return Number.isFinite(configured) ? configured : DEFAULT_RECAPTCHA_MIN_SCORE;
}

export async function verifyRecaptchaToken(input: {
  token: string;
  action?: string;
}) {
  if (!isRecaptchaEnabled()) {
    return {
      ok: true as const,
      skipped: true as const,
    };
  }

  const token = input.token.trim();

  if (!token) {
    return {
      ok: false as const,
      code: "recaptcha_missing",
      message: "Ocorreu um erro ao validar o Recaptcha, tente novamente.",
    };
  }

  try {
    const body = new URLSearchParams({
      secret: getRecaptchaSecretKey(),
      response: token,
    });
    const response = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return {
        ok: false as const,
        code: "recaptcha_unavailable",
        message: "Ocorreu um erro ao validar o Recaptcha, tente novamente.",
      };
    }

    const payload = (await response.json()) as RecaptchaResponse;
    const minScore = getRecaptchaMinScore();
    const actionMatches =
      !input.action || !payload.action || payload.action === input.action;

    if (
      payload.success === true &&
      actionMatches &&
      Number(payload.score ?? 0) >= minScore
    ) {
      return {
        ok: true as const,
        skipped: false as const,
        score: Number(payload.score ?? 0),
      };
    }

    return {
      ok: false as const,
      code: "recaptcha_rejected",
      message: "Ocorreu um erro ao validar o Recaptcha, tente novamente.",
    };
  } catch (error) {
    console.error("recaptcha-verify-failed", error);

    return {
      ok: false as const,
      code: "recaptcha_unavailable",
      message: "Ocorreu um erro ao validar o Recaptcha, tente novamente.",
    };
  }
}
