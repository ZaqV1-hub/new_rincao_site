import type { PoolClient } from "pg";
import { buildSchoolClassDisplay } from "@/lib/school-education";
import { generateUniqueVoucherNumber } from "@/lib/voucher-number";
import type { CreateSchoolPurchaseInput } from "@/lib/school-purchase-input";

export async function insertSchoolPurchaseVoucher(client: Pick<PoolClient, "query">, input: CreateSchoolPurchaseInput,
  purchaseId: number, totalValue: string, visitDate: string,
  participant: { studentName: string; educationType: string | null; educationYear: string | null;
    classLetter: string | null; classDisplay?: string; educatorName: string; educatorRole: string }) {
  const { studentName, educationType, educationYear, classLetter, classDisplay, educatorName, educatorRole } = participant;
  const voucherNumber = await generateUniqueVoucherNumber(client, "ESC-");

    if (input.participantType === "educator") {
      await client.query(
        `
          INSERT INTO voucher (
            idcompra,
            numvoucher,
            idagenda,
            tpvoucher,
            vlunicompra,
            stusado,
            fldesconto,
            idescola,
            tpparticipante,
            nomeeducador,
            funcaoeducador,
            dtvalidade
          )
          VALUES (
            $1,
            $2,
            $3,
            'escol',
            $4,
            'n',
            'n',
            $5,
            $6,
            $7,
            $8,
            $9::date
          )
        `,
        [
          purchaseId,
          voucherNumber,
          input.agendaId,
          totalValue,
          input.schoolId,
          "educador",
          educatorName,
          educatorRole,
          visitDate,
        ],
      );
    } else {
      await client.query(
        `
          INSERT INTO voucher (
            idcompra,
            numvoucher,
            idagenda,
            tpvoucher,
            vlunicompra,
            stusado,
            fldesconto,
            idescola,
            tpparticipante,
            nomealuno,
            ensino_tipo,
            ensino_ano,
            turma_letra,
            turma,
            periodo,
            dtvalidade
          )
          VALUES (
            $1,
            $2,
            $3,
            'escol',
            $4,
            'n',
            'n',
            $5,
            'aluno',
            $6,
            $7,
            $8,
            $9,
            $10,
            '',
            $11::date
          )
        `,
        [
          purchaseId,
          voucherNumber,
          input.agendaId,
          totalValue,
          input.schoolId,
          studentName,
          educationType!,
          educationYear!,
          classLetter!,
          classDisplay ?? buildSchoolClassDisplay(educationType!, educationYear!, classLetter!),
          visitDate,
        ],
      );
    }

}
