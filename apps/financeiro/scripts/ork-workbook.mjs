import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import XLSX from 'xlsx';

export const PARSER_VERSION = 'ork-1';
const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const paymentNames = ['Dinheiro','PIX','Visa crédito','Master crédito','Amex','Elo crédito','Visa débito','Master débito','Elo débito','Permuta','Assinados sócios','Cortesia'];
const value = (ws, cell) => ws[cell]?.v ?? null;
const numeric = n => typeof n === 'number' && Number.isFinite(n);
const iso = n => n instanceof Date && Number.isFinite(n.getTime()) ? `${n.getUTCFullYear()}-${String(n.getUTCMonth()+1).padStart(2,'0')}-${String(n.getUTCDate()).padStart(2,'0')}` : null;
const normalized = s => String(s ?? '').trim().toLocaleLowerCase('pt-BR');

export function parseWorkbook(bytes) {
 const book = XLSX.read(bytes, {type:'buffer',cellDates:true,cellStyles:true,cellFormula:true});
 const checksum = crypto.createHash('sha256').update(bytes).digest('hex');
 const rows = [], issues = [], sheets = [];
 const issue = (key,title,question,evidence={},period=null,severity='atencao') => issues.push({issue_key:`${checksum}:${key}`,title,question,evidence,period,severity});
 for (const [idx,name] of book.SheetNames.entries()) {
  const ws = book.Sheets[name];
  const max = XLSX.utils.decode_range(ws['!ref'] ?? 'A1').e.r+1;
  let imported=0, disposition='';
  const add = (cell,area,kind,amount,description,date=null,category=null,details={},entity=null,period=null) => {
   if (!numeric(amount)) return;
   const occurred_on=iso(date);
   rows.push({source:'planilha',source_ref:`${name}!${cell}`,area,kind,amount,description:String(description || kind),occurred_on,period:period??occurred_on?.slice(0,7)??null,category_original:category?String(category):null,entity:entity?String(entity):null,details:{sheet:name,cell,...details}});
   imported++;
  };
  const monthly = name.match(/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)-(\d{2})$/);
  if (monthly) {
   const period=`20${monthly[2]}-${String(months.indexOf(monthly[1])+1).padStart(2,'0')}`;
   for (const [start,end,shift] of [[7,37,'Almoço'],[42,72,'Jantar']]) {
    for(let r=start;r<=end;r++) {
     const date=value(ws,`B${r}`);
     if(!iso(date)?.startsWith(period)) continue;
     // Only source payment cells; daily and monthly summary formulas are not new sales.
     for(let c=2;c<=13;c++) {
      const cell=`${XLSX.utils.encode_col(c)}${r}`, amount=value(ws,cell);
      if(!numeric(amount)||amount===0) continue;
      add(cell,'receita',c>=11?'nao_monetario':'venda',amount,`${shift} · ${paymentNames[c-2]}`,date,paymentNames[c-2],{shift,notes:value(ws,`P${r}`)},null,period);
     }
    }
   }
   // Acquirer source and expected settlements are evidences, never added to revenue.
   for(const [start,end,kind] of [[119,149,'recebimento_previsto'],[154,184,'recebimento_informado']]) {
    for(let r=start;r<=end;r++) if(iso(value(ws,`B${r}`))) {
     for(let c=4;c<=10;c++) {
      const cell=`${XLSX.utils.encode_col(c)}${r}`, amount=value(ws,cell);
      if(numeric(amount)&&amount!==0) add(cell,'cartoes',kind,amount,paymentNames[c-2],value(ws,`B${r}`),paymentNames[c-2],{},null,period);
     }
    }
   }
   const control=value(ws,'O108');
   const parsed=rows.filter(r=>r.details.sheet===name&&r.area==='receita').reduce((a,r)=>a+r.amount,0);
   if(numeric(control)&&Math.abs(control-parsed)>0.011) issue(`${name}:control`,'Receita não fecha com o total da planilha','Validar o alcance das fórmulas e os dias/turnos preenchidos antes de confirmar a receita.',{source:`${name}!O108`,control,imported:parsed},period,'critico');
   disposition='Receita por turno e forma de pagamento; recebimentos em evidências separadas. Resumos não duplicados.';
  } else if (/^Despesas Operacionais - 202[56]$/.test(name)||name==='Cartão Crédito'||name==='Despesas Pré Op - Allora') {
   const start=name==='Cartão Crédito'?12:name.endsWith('2025')?4:3;
   for(let r=start;r<=max;r++) {
    const amount=value(ws,`F${r}`); if(!numeric(amount)) continue;
    const category=value(ws,`H${r}`), other=name.includes('Allora');
    const area=other?'socios':name==='Cartão Crédito'?'cartoes':normalized(category).includes('investimento')?'investimentos':'despesas';
    add(`F${r}`,area,other?'outra_empresa':name==='Cartão Crédito'?'despesa_cartao':'despesa_informada',amount,value(ws,`E${r}`),value(ws,`C${r}`),category,
     {payer:value(ws,`B${r}`),payment_method:value(ws,`G${r}`),month_marker:value(ws,`A${r}`),date_meaning:'a_confirmar',beneficiary:other?value(ws,`I${r}`):null,already_recorded:other?value(ws,`J${r}`):null},value(ws,`D${r}`));
   }
   disposition='Detalhes preservados. Data informada não implica pagamento nem competência. Categorias originais ainda não homologadas.';
  } else if (name==='Cartão Crédito - Itaú') {
   for(let r=7;r<=max;r++) {
    if(!value(ws,`Z${r}`)) continue;
    for(let c=2;c<=24;c++) {
     const col=XLSX.utils.encode_col(c),cell=`${col}${r}`,amount=value(ws,cell);
     if(numeric(amount)&&amount!==0) add(cell,'cartoes','parcela_cartao',amount,value(ws,`Z${r}`),value(ws,`${col}4`),value(ws,`AA${r}`),{purchase_date:iso(value(ws,`B${r}`)),date_meaning:'vencimento',sign_convention:'original_negativo_despesa'});
    }
   }
   disposition='Parcelas, inclusive colunas ocultas; resumos de fatura não são novas despesas.';
  } else if (name==='Caixa Dinheiro') {
   for(let r=3;r<=max;r++) for(const [col,datecol,kind,desc] of [['B','A','entrada_caixa','Entrada em dinheiro'],['C','D','saida_caixa',value(ws,`E${r}`)],['I','H','entrada_pendente','Entrada pendente'],['J','K','saida_pendente',value(ws,`L${r}`)]]) {
    const amount=value(ws,`${col}${r}`); if(numeric(amount)&&amount!==0) add(`${col}${r}`,'caixa',kind,amount,desc,value(ws,`${datecol}${r}`),null,{person:value(ws,`M${r}`)});
   }
   disposition='Movimentos e pendências separados; saldo não tratado como receita.';
  } else if (name==='Resumo Financeiro') {
   for(let r=7;r<=18;r++) add(`G${r}`,'investimentos','aporte_referencia',value(ws,`G${r}`),value(ws,`I${r}`),value(ws,`H${r}`),null,{scope:'Resumo histórico; pode repetir transferências detalhadas'});
   for(let r=7;r<=27;r++) for(const col of ['M','N','O']) {
    if(numeric(value(ws,`${col}${r}`))) add(`${col}${r}`,'socios','consumo_credito_permuta',value(ws,`${col}${r}`),value(ws,`${col}5`),value(ws,`L${r}`),null,{scope:'Baixa de crédito/permuta; não é nova venda'});
   }
   for(let r=42;r<=max;r++) for(const [dateCol,descCol,amountCol,noteCol,entity] of [['G','H','I',null,r>=64?'Nori San':'Food-Society Volano'],['K','L','M','N','Dhuroc'],['O','P','Q','R','Pessoa física'],['T','U','V','W','Samuel']]) {
    if(iso(value(ws,`${dateCol}${r}`))) add(`${amountCol}${r}`,'socios','transferencia_referencia',value(ws,`${amountCol}${r}`),value(ws,`${descCol}${r}`),value(ws,`${dateCol}${r}`),null,{notes:noteCol?value(ws,`${noteCol}${r}`):null,scope:'Transferência: não classificada como receita/despesa'},entity);
   }
   issue(`${name}:scope`,'Confirmar aportes, distribuições e transferências entre empresas','Quais movimentações pertencem à Marena? Confirmar capital, empréstimo, devolução e distribuição; o resumo histórico pode repetir detalhes.',{sheet:name});
   disposition='Aportes históricos, consumo de créditos e transferências separados por natureza/empresa. Campos de previsão e extratos vazios não inventados.';
  } else if (/^Consolidado - 202[56]$/.test(name)) {
   const year=name.slice(-4);
   for(let r=14;r<=170;r++) {
    const category=value(ws,`B${r}`); if(typeof category!=='string'||!category.trim()) continue;
    for(let m=0;m<12;m++) {
     const cell=`${XLSX.utils.encode_col(3+m*3)}${r}`;
     add(cell,'orcamento','orcamento_referencia',value(ws,cell),category,null,category,{group:value(ws,`A${r}`),classification:'a_validar'},null,`${year}-${String(m+1).padStart(2,'0')}`);
    }
   }
   if(year==='2026') {
    for(let r=27;r<=30;r++) for(let m=0;m<12;m++) {
     const cell=`${XLSX.utils.encode_col(53+m)}${r}`;
     add(cell,'investimentos','juros_simulados',value(ws,cell),'Simulação de juros sobre capital (não realizado)',null,null,{formula:ws[cell]?.f??null},null,`${value(ws,`BA${r}`)}-${String(m+1).padStart(2,'0')}`);
    }
    issue('simulated-interest','Juros simulados não são despesa comprovada','Os juros calculados sobre capital são apenas custo de oportunidade ou existem contratos e pagamentos reais? Não foram lançados como despesa.',{source:`${name}!BB27:BM30`});
    issue('card-rates','Propostas e taxas de adquirência precisam de vigência','Confirmar a adquirente e as taxas contratadas por bandeira e período. Propostas não substituem as taxas efetivas.',{source:`${name}!BA35:BI47`});
   }
   disposition='Orçamento de referência separado do realizado. Fórmulas gerenciais e simulações não geram DRE nem lançamentos.';
  } else {
   disposition=book.Workbook?.Sheets?.[idx]?.Hidden ? 'Legado/aba oculta preservada no arquivo; fora dos lançamentos até confirmar aplicabilidade.' : 'Resumo ou bloco de layout específico: não convertido automaticamente em novos lançamentos.';
   issue(`${name}:coverage`,`Revisar cobertura: ${name}`,'Confirmar quais informações deste bloco pertencem à Marena e mapear os detalhes que ainda não foram convertidos, sem repetir os lançamentos já importados.',{sheet:name,disposition},null,'informacao');
  }
  for(const [cell,obj] of Object.entries(ws)) {
   if(cell.startsWith('!')) continue;
   if(obj.t==='e'||obj.f?.includes('#REF!')) issue(`${name}:${cell}`,obj.f?.includes('#REF!')?'Referência quebrada na planilha':'Fórmula com erro na planilha','Qual é a referência ou valor correto? O resultado não será presumido como zero.',{source:`${name}!${cell}`,formula:obj.f??null,value:obj.w??obj.v},null,'critico');
  }
  sheets.push({name,hidden:!!book.Workbook?.Sheets?.[idx]?.Hidden,records:imported,disposition});
 }
 issue('dates','Datas e quitação das despesas precisam de confirmação','A coluna Data representa vencimento, pagamento ou competência? Quais despesas estão efetivamente pagas? Não foi presumida quitação.');
 issue('categories','Categorias da futura DRE aguardam homologação','Confirmar o plano de contas e o enquadramento das categorias originais. A DRE não foi criada.');
 issue('card-overlap','Cartões podem repetir despesas operacionais','Quais parcelas e faturas já aparecem em Despesas Operacionais? Vincular as evidências do mesmo gasto, sem somá-las.');
 issue('item-detail','A planilha de receita não informa produtos e quantidades','Enviar o relatório de itens vendidos para comparar produtos e quantidades. Valores por bandeira não permitem inferir pratos vendidos.',{},null,'informacao');
 const keys=new Map();
 for(const r of rows.filter(r=>r.kind==='despesa_informada')) {
  const key=JSON.stringify([r.occurred_on,normalized(r.entity),Math.round(r.amount*100),normalized(r.category_original),r.details.payer,r.details.month_marker]);
  const list=keys.get(key)??[];list.push(r.source_ref);keys.set(key,list);
 }
 for(const [key,refs] of keys) if(refs.length>1) issue(`duplicate:${key}`,'Possível repetição de despesa','Esses registros com mesmos campos representam gastos distintos ou repetição? Nenhuma linha foi removida automaticamente.',{refs});
 return {checksum,parser_version:PARSER_VERSION,rows,issues,manifest:{sheets,records:rows.length,issues:issues.length}};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const parsed=parseWorkbook(fs.readFileSync(process.argv[2]));
 const target=process.argv[3];
 if(!target) throw new Error('Informe o caminho de saída JSON.');
 fs.writeFileSync(target,JSON.stringify(parsed));
 console.log(JSON.stringify({checksum:parsed.checksum,manifest:parsed.manifest}));
}
