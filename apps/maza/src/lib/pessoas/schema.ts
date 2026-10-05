import { z } from "zod";

// Schema único — usado pelo form (client) e pelas Server Actions (validação dupla).
// Strings vazias para campos opcionais são permitidas (formulários HTML mandam "").

const optionalString = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

// UF: 2 letras maiúsculas. Aceita vazio, transforma "" em null.
const optionalUf = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || /^[A-Za-z]{2}$/.test(v), "UF deve ter 2 letras")
  .transform((v) => (v ? v.toUpperCase() : null));

const cpfRegex = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;

export const employeeFormSchema = z
  .object({
    // Identificação
    nome: z.string().trim().min(1, "Obrigatório").max(80),
    sobrenome: z.string().trim().min(1, "Obrigatório").max(120),
    funcao: z.string().trim().min(1, "Obrigatório").max(80),
    salario_base: z.coerce
      .number({ error: "Informe um número" })
      .positive("Deve ser maior que zero"),
    data_admissao: z
      .string()
      .min(1, "Obrigatório")
      .refine((s) => {
        const d = new Date(`${s}T00:00:00`);
        if (Number.isNaN(d.getTime())) return false;
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return d <= today;
      }, "Data não pode ser futura"),
    cpf: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine((s) => !s || cpfRegex.test(s), "CPF inválido (use 000.000.000-00 ou 11 dígitos)")
      .transform((v) => (v ? v : null)),

    // Documentos
    rg: optionalString,
    rg_orgao: optionalString,
    rg_uf: optionalUf,
    pis: optionalString,
    ctps: optionalString,
    ctps_serie: optionalString,
    ctps_uf: optionalUf,
    titulo_eleitor: optionalString,
    reservista: optionalString,

    // Endereço
    cep: optionalString,
    rua: optionalString,
    numero: optionalString,
    complemento: optionalString,
    bairro: optionalString,
    cidade: optionalString,
    estado: optionalUf,

    // Sociodemográfico
    escolaridade: optionalString,
    raca: optionalString,
    genero: optionalString,
    nome_mae: optionalString,
    nome_pai: optionalString,
    departamento: optionalString,

    // Bancário
    banco: optionalString,
    agencia: optionalString,
    conta: optionalString,
    tipo_conta: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => !v || v === "corrente" || v === "poupanca" || v === "salario",
        "Tipo de conta inválido",
      )
      .transform((v) => (v ? (v as "corrente" | "poupanca" | "salario") : null)),
    pix: optionalString,

    // ── HOS RH expansion (migration 011) ────────────────────────
    // Identificação
    employee_code: optionalString,
    esocial_code: optionalString,
    nome_social: optionalString,

    // Nascimento
    data_nascimento: optionalString,
    cidade_nascimento: optionalString,
    uf_nascimento: optionalUf,
    pais_nascimento: optionalString,
    estado_civil: optionalString,

    // Contrato
    tipo_contrato: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => !v || ["CLT", "PJ", "temporario", "estagiario"].includes(v),
        "Tipo de contrato inválido",
      )
      .transform((v) =>
        v ? (v as "CLT" | "PJ" | "temporario" | "estagiario") : null,
      ),
    jornada: optionalString,
    status_rh: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => !v || ["ativo", "inativo", "ferias", "afastado"].includes(v),
        "Status inválido",
      )
      .transform((v) =>
        v ? (v as "ativo" | "inativo" | "ferias" | "afastado") : "ativo",
      ),

    // Contato
    telefone: optionalString,
    email: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => !v || /^\S+@\S+\.\S+$/.test(v),
        "Email inválido",
      )
      .transform((v) => (v ? v : null)),
    photo_url: optionalString,

    // Emergência
    contato_emergencia_nome: optionalString,
    contato_emergencia_tel: optionalString,

    // Eleitoral + estrangeiro
    zona_eleitoral: optionalString,
    secao_eleitoral: optionalString,
    rne: optionalString,
    rne_orgao: optionalString,
    rne_expedicao: optionalString,
    ctps_expedicao: optionalString,
  })
  .strict();

export type EmployeeFormInput = z.input<typeof employeeFormSchema>;
export type EmployeeFormOutput = z.output<typeof employeeFormSchema>;
