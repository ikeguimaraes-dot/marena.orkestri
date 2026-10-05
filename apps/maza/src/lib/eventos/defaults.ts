// Defaults pré-preenchidos no form de O.S. (vindos do HOS legado).

import type { BrigadaItem, MenuItem } from "./types";

/** Brigada padrão sugerida ao criar nova O.S. */
export const BRIGADA_PADRAO: ReadonlyArray<BrigadaItem> = [
  { funcao: "Maître", qtd: 1 },
  { funcao: "Chefe de Fila", qtd: 1 },
  { funcao: "Garçon", qtd: 6 },
  { funcao: "Cumin", qtd: 2 },
  { funcao: "Limpeza", qtd: 2 },
  { funcao: "Chefe de Bar", qtd: 1 },
  { funcao: "Bartender", qtd: 3 },
  { funcao: "Barback", qtd: 2 },
  { funcao: "Chef de Cozinha", qtd: 1 },
  { funcao: "Segurança", qtd: 1 },
];

/** Linhas pre-criadas ao abrir Menu Bar — serviços padrão. */
export const MENU_BAR_DEFAULT_ROWS: ReadonlyArray<MenuItem> = [
  { categoria: "Menu Aberto", servico: "Não Alcóolicas", hr_ini: null, hr_fim: null, descritivo: "", obs: "" },
  { categoria: "Menu Aberto", servico: "Alcóolicas", hr_ini: null, hr_fim: null, descritivo: "", obs: "" },
  { categoria: "Menu Aberto", servico: "Vinhos e Champanhes", hr_ini: null, hr_fim: null, descritivo: "", obs: "" },
  { categoria: "Menu Aberto", servico: "Encerramento de Serviço", hr_ini: null, hr_fim: null, descritivo: "", obs: "" },
];

export const MENU_COZINHA_DEFAULT_ROWS: ReadonlyArray<MenuItem> = [
  { categoria: "Empratado", servico: "Entradas", hr_ini: null, hr_fim: null, descritivo: "", obs: "" },
  { categoria: "Empratado", servico: "Saladas", hr_ini: null, hr_fim: null, descritivo: "", obs: "" },
  { categoria: "Empratado", servico: "Principais", hr_ini: null, hr_fim: null, descritivo: "", obs: "" },
  { categoria: "Empratado", servico: "Sobremesas", hr_ini: null, hr_fim: null, descritivo: "", obs: "" },
  { categoria: "Empratado", servico: "Encerramento de Serviço", hr_ini: null, hr_fim: null, descritivo: "", obs: "" },
];

/** Linha vazia pra append. */
export const EMPTY_MENU_ROW: MenuItem = {
  categoria: "",
  servico: "",
  hr_ini: null,
  hr_fim: null,
  descritivo: "",
  obs: "",
};

export const EMPTY_BRIGADA_ROW: BrigadaItem = {
  funcao: "",
  qtd: 1,
};
