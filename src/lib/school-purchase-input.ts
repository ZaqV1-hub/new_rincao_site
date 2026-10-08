export type CreateStudentPurchaseInput = {
  participantType?: "student";
  schoolId: number;
  studentName: string;
  educationType: string;
  educationYear: string;
  classLetter: string;
  agendaId: number;
  value: string;
};

export type CreateEducatorPurchaseInput = {
  participantType: "educator";
  schoolId: number;
  educatorName: string;
  educatorRole: string;
  agendaId: number;
  value: string;
};

export type CreateSchoolPurchaseInput =
  | CreateStudentPurchaseInput
  | CreateEducatorPurchaseInput;

export class SchoolPurchaseError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "SchoolPurchaseError";
    this.code = code;
    this.status = status;
  }
}
