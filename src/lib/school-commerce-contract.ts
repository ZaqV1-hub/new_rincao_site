import { createHash } from "node:crypto";

export type SchoolSnapshot = {
  schema_version: "commerce_school_snapshot_v1";
  school_id: number; agenda_id: number; school_name: string; school_address: string;
  student_name: string; education_type: string; education_year: string; class_letter: string;
  education_type_label: string; education_year_label: string; class_display: string;
  visit_date: string; declared_amount: number;
};
export type SiteSchoolContext = {
  schema_version: "site_school_context_v1"; tenant_id: string;
  buyer: { name: string; cpf: string; phone: string; email?: string };
  quote: { school_purchase: SchoolSnapshot; school_review?: { reference: string; binding_hash: string; expires_at: string };
    totalAmount: number; items: unknown[]; [key: string]: unknown };
};

// Wire contract shared with the tenant: recursively sorted JSON, UTF-8 SHA-256.
export function schoolContractHash(value: unknown): string {
  const canonical = (entry: unknown): string => {
    if (entry === null || typeof entry !== "object") return JSON.stringify(entry);
    if (Array.isArray(entry)) return "[" + entry.map(canonical).join(",") + "]";
    const record = entry as Record<string, unknown>;
    return "{" + Object.keys(record).sort().map(key => JSON.stringify(key) + ":" + canonical(record[key])).join(",") + "}";
  };
  return "sha256:" + createHash("sha256").update(canonical(value)).digest("hex");
}

export function schoolIdentityLockKey(school: Pick<SchoolSnapshot,
  "school_id" | "agenda_id" | "student_name" | "education_type" | "education_year" | "class_letter">) {
  return "school-admission:" + schoolContractHash({ school_id: school.school_id, agenda_id: school.agenda_id,
    student_name: school.student_name, education_type: school.education_type, education_year: school.education_year,
    class_letter: school.class_letter });
}

export function siteSchoolAdmissionEnabled() {
  return process.env.SCHOOL_COMMERCE_ADMISSION_ENABLED === "true";
}
