import {
  registrationFieldOrder,
  type RegistrationSubmissionInput,
} from "@/lib/group-registration-form-data";
import { queueLegacyEmail } from "@/lib/legacy-email";

type GroupRegistrationEmailSubmission = {
  protocol: string;
  createdAt: string;
  storage: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getRecipient() {
  return (
    process.env.GROUP_REGISTRATION_EMAIL_TO?.trim() ||
    process.env.EMAIL_REPLYTO_ADDRESS?.trim() ||
    process.env.EMAIL_FROM_ADDRESS?.trim() ||
    "ingressos@rincao.local"
  );
}

export function buildGroupRegistrationEmailHtml(
  input: RegistrationSubmissionInput,
  submission: GroupRegistrationEmailSubmission,
) {
  const rows = registrationFieldOrder
    .map(({ label, name }) => {
      const value = input[name] || "-";

      return `
        <tr>
          <th align="left" style="padding:8px;border-bottom:1px solid #d8e2eb;">${escapeHtml(label)}</th>
          <td style="padding:8px;border-bottom:1px solid #d8e2eb;">${escapeHtml(value)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <h1>Nova solicitacao de grupo</h1>
    <p><strong>Protocolo:</strong> ${escapeHtml(submission.protocol)}</p>
    <p><strong>Origem:</strong> ${escapeHtml(input.pageTitle)} (${escapeHtml(input.slug)})</p>
    <p><strong>Data:</strong> ${escapeHtml(submission.createdAt)}</p>
    <p><strong>Armazenamento:</strong> ${escapeHtml(submission.storage)}</p>
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:760px;">
      <tbody>${rows}</tbody>
    </table>
  `;
}

export async function sendGroupRegistrationEmail(
  input: RegistrationSubmissionInput,
  submission: GroupRegistrationEmailSubmission,
) {
  await queueLegacyEmail({
    to: getRecipient(),
    toName: "Clube Rincao",
    subject: `[Site Rincao] ${input.pageTitle} - ${submission.protocol}`,
    html: buildGroupRegistrationEmailHtml(input, submission),
  });
}
