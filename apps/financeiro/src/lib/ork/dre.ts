import type {MonthlyEvidence} from './monthly';

export const DRE_GROUPS={
 receita:'Receita',cmv:'CMV e insumos',pessoal:'Folha e pessoal',ocupacao:'Ocupação e utilidades',manutencao:'Manutenção',marketing:'Marketing',administrativas:'Administrativas',tributos:'Tributos',financeiras:'Financeiras',outras:'Outras despesas',fora_dre:'Investimentos, empréstimos e ativos',nao_classificados:'Não classificados',
} as const;
export type DreGroup=keyof typeof DRE_GROUPS;

const normalize=(value:string|null)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const has=(value:string,terms:string[])=>terms.some(term=>value.includes(term));

export function dreGroup(row:MonthlyEvidence):DreGroup{
 if(row.area==='receita') return 'receita';
 const cc=normalize(row.category_original);
 const nature=normalize(row.description);
 const text=`${cc} ${nature}`;
 if(!cc) return 'nao_classificados';
 if(has(cc,['investimento','emprestimo','aporte','transferencia'])) return 'fora_dre';
 if(has(cc,['depositos judiciais'])&&!has(nature,['custas judiciais'])) return 'fora_dre';
 if(has(cc,['materia prima','itens de revenda','embalagen'])) return 'cmv';
 if(has(cc,['inss','fgts','pis','cofins','icms','irpj','csll','difal','irrf','imposto retido','impostos retidos','taxas e emolumentos'])) return 'tributos';
 if(has(text,['cat - acidente funcionario'])) return 'pessoal';
 if(has(cc,['salario','rescis','ferias','13º','13o','hora extra','vale transporte','vale refeicao','premios','gratific','assistencia medica','odontologica','pensao','medicina do trabalho','seguro de vida','acordo trabalhista','sindical','pro labore','pro-labore','locacao de mao de obra'])) return 'pessoal';
 if(has(cc,['locacao de imove','energia eletrica','agua','gas','iptu','seguranca','limpeza e conservacao','remocao de lixo'])) return 'ocupacao';
 if(has(text,['manutencao','materiais de manutencao','conserto','reforma','compra ferro','filtro de agua'])) return 'manutencao';
 if(has(cc,['mkt','marketing','publicidade','propaganda','comunicacao visual','viagens e eventos'])) return 'marketing';
 if(has(cc,['juros','tarifas bancarias'])) return 'financeiras';
 if(has(cc,['assessoria','consultoria','juridica','software','ti','telefonia','materiais administrativos','datacenter','seguros','ensino e treinamento','analise tecnica','engenharia','prestadores pj','reembolso de despesa','depositos judiciais'])) return 'administrativas';
 return 'outras';
}

export function dreSignedAmount(row:MonthlyEvidence){
 const amount=Number(row.amount)||0;
 return dreGroup(row)==='receita'?amount:-amount;
}

export const matchesDreMonth=(row:MonthlyEvidence,month:string|null)=>!month||row.period?.slice(5,7)===month;
