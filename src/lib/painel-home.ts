import { getIngressoDbPool } from "@/lib/ingresso-db";

type PainelHomeEmailErrorRow = {
  filaerro: string | number | null;
};

type PainelHomeRevenueRow = {
  site_total: string | number | null;
  box_office_total: string | number | null;
};

export type PainelHomeUrlItem = {
  url: string;
  accessCount: number;
};

export type PainelHomePageData = {
  emailErrorCount: number;
  revenue: {
    site: number;
    boxOffice: number;
    total: number;
  };
  urls: PainelHomeUrlItem[];
};

export async function loadPainelHomePageData(): Promise<PainelHomePageData> {
  const pool = getIngressoDbPool();
  const emailResult = await pool.query<PainelHomeEmailErrorRow>(
    `
      SELECT count(*) AS filaerro
      FROM email
      WHERE stemail = 'nov'
        AND erros > 0
    `,
  );
  const revenueResult = await pool.query<PainelHomeRevenueRow>(
    `
      SELECT
        COALESCE(SUM(CASE WHEN c.tpcompra = 'ponli' THEN v.vlunicompra ELSE 0 END), 0)::text AS site_total,
        COALESCE(SUM(CASE WHEN c.tpcompra IN ('bilhe', 'reser') THEN v.vlunicompra ELSE 0 END), 0)::text AS box_office_total
      FROM compra c
      JOIN voucher v ON v.idcompra = c.idcompra
      WHERE c.stcompra = 'conc'
        AND c.dtcompra = CURRENT_DATE
    `,
  );
  const site = Number(revenueResult.rows[0]?.site_total ?? 0);
  const boxOffice = Number(revenueResult.rows[0]?.box_office_total ?? 0);

  return {
    emailErrorCount: Number(emailResult.rows[0]?.filaerro ?? 0),
    revenue: {
      site,
      boxOffice,
      total: site + boxOffice,
    },
    urls: [],
  };
}
