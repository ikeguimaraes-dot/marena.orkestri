// PDF do holerite. Renderizado via @react-pdf/renderer no servidor (route
// handler). NÃO usa React DOM — só os primitivos do react-pdf.

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { Payslip } from "@maza/db/types/pessoas";

const MARENA_GOLD = "#D4A574";
const TEXT = "#1F1F1F";
const TEXT_2 = "#525252";
const BORDER = "#E5E5E5";

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingHorizontal: 40,
    paddingBottom: 32,
    fontSize: 10,
    color: TEXT,
    fontFamily: "Helvetica",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: MARENA_GOLD,
    paddingBottom: 12,
    marginBottom: 18,
  },
  brand: {
    fontSize: 9,
    letterSpacing: 2,
    color: MARENA_GOLD,
    fontWeight: 700,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginTop: 4,
    color: TEXT,
  },
  meta: {
    fontSize: 9,
    color: TEXT_2,
    marginTop: 4,
  },
  section: {
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 8,
    letterSpacing: 1.5,
    color: TEXT_2,
    fontWeight: 700,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  rowLabel: {
    color: TEXT,
    fontSize: 10,
  },
  rowValue: {
    color: TEXT,
    fontSize: 10,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: TEXT,
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: 700,
  },
  liquidoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
    padding: 14,
    backgroundColor: "#F8F4EE",
    borderRadius: 4,
  },
  liquidoLabel: {
    fontSize: 9,
    letterSpacing: 1.4,
    color: TEXT_2,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  liquidoValue: {
    fontSize: 22,
    color: MARENA_GOLD,
    fontWeight: 700,
  },
  signatureBlock: {
    marginTop: 60,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureLine: {
    width: "45%",
    borderTopWidth: 1,
    borderTopColor: TEXT_2,
    paddingTop: 6,
    fontSize: 9,
    color: TEXT_2,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7,
    color: TEXT_2,
    textAlign: "center",
    letterSpacing: 0.6,
  },
  green: { color: "#15803D" },
  red: { color: "#B91C1C" },
});

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function brl(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return BRL.format(0);
  const n = typeof v === "string" ? Number(v) : v;
  return BRL.format(Number.isFinite(n) ? n : 0);
}

function competenciaLabel(iso: string): string {
  // "2026-04-01" → "Abril/2026"
  const m = Number(iso.slice(5, 7));
  const y = iso.slice(0, 4);
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${meses[m - 1] ?? ""}/${y}`;
}

export type PayslipPdfProps = {
  payslip: Payslip;
  employeeName: string;
  employeeFuncao: string;
  employeeCpf: string | null;
  unitName: string;
  brandName: string | null;
};

export function PayslipPdf({
  payslip,
  employeeName,
  employeeFuncao,
  employeeCpf,
  unitName,
  brandName,
}: PayslipPdfProps) {
  const totalProventos =
    Number(payslip.salario_base) +
    Number(payslip.horas_extras) +
    Number(payslip.adicional_noturno) +
    Number(payslip.gorjeta) +
    Number(payslip.dsr_gorjeta) +
    Number(payslip.outros_acrescimos);

  const totalDescontos =
    Number(payslip.desconto_inss) +
    Number(payslip.desconto_irrf) +
    Number(payslip.desconto_vale_transporte) +
    Number(payslip.desconto_vale_refeicao) +
    Number(payslip.outros_descontos);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>{brandName ? brandName.toUpperCase() : "MARENA"}</Text>
          <Text style={styles.title}>Recibo de pagamento de salário</Text>
          <Text style={styles.meta}>
            {unitName} · Competência {competenciaLabel(payslip.competencia)}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Colaborador</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Nome</Text>
            <Text style={styles.rowValue}>{employeeName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Função</Text>
            <Text style={styles.rowValue}>{employeeFuncao}</Text>
          </View>
          {employeeCpf && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>CPF</Text>
              <Text style={styles.rowValue}>{employeeCpf}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Proventos</Text>
          <ProventoRow label="Salário-base" value={payslip.salario_base} />
          <ProventoRow label="Horas extras" value={payslip.horas_extras} />
          <ProventoRow label="Adicional noturno" value={payslip.adicional_noturno} />
          <ProventoRow label="Gorjeta" value={payslip.gorjeta} />
          <ProventoRow label="DSR sobre gorjeta" value={payslip.dsr_gorjeta} />
          <ProventoRow label="Outros acréscimos" value={payslip.outros_acrescimos} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total proventos</Text>
            <Text style={[styles.totalLabel, styles.green]}>{brl(totalProventos)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Descontos</Text>
          <DescontoRow label="INSS" value={payslip.desconto_inss} />
          <DescontoRow label="IRRF" value={payslip.desconto_irrf} />
          <DescontoRow label="Vale-transporte" value={payslip.desconto_vale_transporte} />
          <DescontoRow label="Vale-refeição" value={payslip.desconto_vale_refeicao} />
          <DescontoRow label="Outros descontos" value={payslip.outros_descontos} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total descontos</Text>
            <Text style={[styles.totalLabel, styles.red]}>{brl(totalDescontos)}</Text>
          </View>
        </View>

        <View style={styles.liquidoRow}>
          <Text style={styles.liquidoLabel}>Líquido a receber</Text>
          <Text style={styles.liquidoValue}>{brl(payslip.liquido)}</Text>
        </View>

        <View style={styles.signatureBlock}>
          <Text style={styles.signatureLine}>Assinatura do empregador</Text>
          <Text style={styles.signatureLine}>Assinatura do empregado</Text>
        </View>

        <Text style={styles.footer}>
          Documento gerado por Marena · {new Date().toLocaleDateString("pt-BR")}
        </Text>
      </Page>
    </Document>
  );
}

function ProventoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, styles.green]}>{brl(value)}</Text>
    </View>
  );
}

function DescontoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, styles.red]}>{brl(value)}</Text>
    </View>
  );
}
