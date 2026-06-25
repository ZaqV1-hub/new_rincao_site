/* eslint-disable jsx-a11y/alt-text */

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { UserVoucherPurchase } from "@/lib/voucher-contracts";

export type VoucherPdfVoucher = {
  id: number;
  number: string | null;
  typeLabel: string;
  visitDate: string | null;
  unitValue: string | null;
  schoolName: string | null;
  participantName: string | null;
  schoolClassDisplay: string | null;
  qrCodeDataUrl: string | null;
};

type VoucherPdfInput = {
  purchase: Pick<
    UserVoucherPurchase,
    "id" | "type" | "purchaseDate" | "statusLabel"
  >;
  customer: {
    name: string;
    cpfMasked: string;
  };
  vouchers: VoucherPdfVoucher[];
  information: string | null;
  isSchool: boolean;
};

const styles = StyleSheet.create({
  page: {
    padding: 28,
    backgroundColor: "#f4f6f1",
    color: "#35503b",
    fontSize: 11,
    fontFamily: "Helvetica",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    border: "1 solid #cfe0ca",
    overflow: "hidden",
  },
  header: {
    backgroundColor: "#1f6b36",
    paddingHorizontal: 24,
    paddingVertical: 18,
    alignItems: "center",
  },
  logoTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  logoSubtitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  headerBadge: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    color: "#1f6b36",
    fontSize: 8,
    textTransform: "uppercase",
  },
  voucherNumber: {
    marginTop: 8,
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "bold",
  },
  body: {
    padding: 22,
    gap: 16,
  },
  sectionTitle: {
    color: "#2b8c46",
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  primaryValue: {
    fontSize: 15,
    color: "#17351f",
    fontWeight: "bold",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  detailsColumn: {
    flexGrow: 1,
    flexShrink: 1,
    gap: 3,
    lineHeight: 1.45,
  },
  qrColumn: {
    width: 112,
    alignItems: "center",
    justifyContent: "center",
  },
  qrImage: {
    width: 92,
    height: 92,
  },
  divider: {
    height: 1,
    backgroundColor: "#dce8d8",
  },
  footer: {
    borderTop: "1 solid #dce8d8",
    paddingHorizontal: 22,
    paddingVertical: 16,
    color: "#5b6f5e",
    textAlign: "center",
    fontSize: 10,
    lineHeight: 1.5,
  },
  infoPage: {
    padding: 28,
    backgroundColor: "#eef4eb",
  },
  infoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 24,
    lineHeight: 1.6,
    color: "#4f6953",
  },
  infoTitle: {
    color: "#17351f",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  infoParagraph: {
    marginBottom: 8,
  },
});

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const [year, month, day] = value.split("-");

  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatCurrency(value: string | null) {
  if (!value) {
    return "-";
  }

  const amount = Number(value);

  return Number.isNaN(amount)
    ? value
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(amount);
}

function splitInformation(text: string | null) {
  if (!text) {
    return [];
  }

  return text
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function VoucherDocument({
  input,
}: {
  input: VoucherPdfInput;
}) {
  const infoParagraphs = splitInformation(input.information);

  return (
    <Document title={`voucher-${input.purchase.id}`}>
      {input.vouchers.map((voucher) => (
        <Page key={voucher.id} size="A4" style={styles.page}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.logoTitle}>Estancia e Parque</Text>
              <Text style={styles.logoSubtitle}>Ecologica das Aguas</Text>
              <Text style={styles.headerBadge}>
                {input.purchase.type === "reser" ? "Voucher de reserva" : "Voucher"}
              </Text>
              <Text style={styles.voucherNumber}>
                {voucher.number ?? `Voucher #${voucher.id}`}
              </Text>
            </View>

            <View style={styles.body}>
              <View>
                <Text style={styles.sectionTitle}>Passaporte</Text>
                <Text style={styles.primaryValue}>{voucher.typeLabel}</Text>
                <Text>Valido para a visita de {formatDate(voucher.visitDate)}.</Text>
                <Text>Valor unitario: {formatCurrency(voucher.unitValue)}.</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.detailsColumn}>
                  <Text style={styles.sectionTitle}>Dados da compra</Text>
                  {input.isSchool ? (
                    <>
                      <Text>
                        <Text style={styles.primaryValue}>Nome do aluno: </Text>
                        {voucher.participantName ?? "-"}
                      </Text>
                      <Text>
                        <Text style={styles.primaryValue}>Unidade escolar: </Text>
                        {voucher.schoolName ?? "-"}
                      </Text>
                      <Text>
                        <Text style={styles.primaryValue}>Tipo/Ano/Turma: </Text>
                        {voucher.schoolClassDisplay ?? "-"}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text>
                        <Text style={styles.primaryValue}>Nome: </Text>
                        {input.customer.name}
                      </Text>
                      <Text>
                        <Text style={styles.primaryValue}>CPF: </Text>
                        {input.customer.cpfMasked}
                      </Text>
                    </>
                  )}
                  <Text>
                    <Text style={styles.primaryValue}>ID da compra: </Text>
                    {String(input.purchase.id)}
                  </Text>
                  <Text>
                    <Text style={styles.primaryValue}>Status: </Text>
                    {input.purchase.type === "reser"
                      ? "Reserva"
                      : input.purchase.statusLabel}
                  </Text>
                  <Text>
                    <Text style={styles.primaryValue}>Data da compra: </Text>
                    {formatDate(input.purchase.purchaseDate)}
                  </Text>
                </View>

                {!input.isSchool ? (
                  <View style={styles.qrColumn}>
                    {voucher.qrCodeDataUrl ? (
                      <Image src={voucher.qrCodeDataUrl} style={styles.qrImage} />
                    ) : (
                      <Text>QR Code indisponivel</Text>
                    )}
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.footer}>
              <Text>
                Obrigatorio apresentar este voucher na bilheteria. Se necessario,
                reagende sua visita pela sua conta.
              </Text>
              <Text>Atencao para as instrucoes na ultima pagina.</Text>
            </View>
          </View>
        </Page>
      ))}

      {infoParagraphs.length > 0 ? (
        <Page size="A4" style={styles.infoPage}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Informacoes</Text>
            {infoParagraphs.map((paragraph, index) => (
              <Text key={`${paragraph}-${index}`} style={styles.infoParagraph}>
                {paragraph}
              </Text>
            ))}
          </View>
        </Page>
      ) : null}
    </Document>
  );
}

export async function renderVoucherPdfBuffer(input: VoucherPdfInput) {
  return renderToBuffer(<VoucherDocument input={input} />);
}
