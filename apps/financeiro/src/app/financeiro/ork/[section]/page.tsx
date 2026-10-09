import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUnit } from "@maza/auth/unit";
import { createFinanceiroClient } from "@/lib/financeiro/db/client";
import { ORK_SECTIONS, isReconciliationUnit, type OrkSection } from "@/lib/ork/config";
import { PageHeading } from "@/components/ui/PageHeading";
import { recordDecision } from "./actions";
import styles from "./page.module.css";
import { ReviewPage } from './ReviewPage';
import { RevenuePage } from './RevenuePage';
import { MonthlyAreaPage } from './MonthlyAreaPage';
import {DrePage} from './DrePage';

export const dynamic='force-dynamic';
const brl=(n:number|null)=>n===null?'Não informado':Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const kinds:Record<string,string>={venda:'Vendas monetárias',nao_monetario:'Permutas, assinados e cortesias',despesa_informada:'Despesas informadas (quitação a confirmar)',despesa_cartao:'Despesas no cartão',parcela_cartao:'Parcelas (sinal original)',entrada_caixa:'Entradas',saida_caixa:'Saídas',entrada_pendente:'Entradas pendentes',saida_pendente:'Saídas pendentes',recebimento_previsto:'Recebimentos previstos',recebimento_informado:'Recebimentos informados',outra_empresa:'Gastos de outras empresas',orcamento_referencia:'Orçamento de referência',nfe_entrada:'NF-e de entrada',nfe_saida:'NF-e de saída',efd:'Receita fiscal EFD'};
type Evidence={id:string;source:string;source_ref:string;kind:string;occurred_on:string|null;description:string;entity:string|null;amount:number|null;category_original:string|null;details:Record<string,unknown>};
type Issue={id:string;title:string;question:string;severity:string;period:string|null;evidence:Record<string,unknown>};
type Decision={issue_id:string;status:string;explanation:string;created_at:string};
const labels:Record<string,string>={sheet:'Aba de origem',cell:'Célula',shift:'Turno',notes:'Observação',payer:'Pagador',payment_method:'Pagamento',month_marker:'Mês indicado',date_meaning:'Significado da data',beneficiary:'Beneficiário',already_recorded:'Já registrado?',purchase_date:'Data da compra',person:'Pessoa',sign_convention:'Convenção de sinal',group:'Grupo original',classification:'Classificação',source_unit_id:'Unidade de origem',snapshot_at:'Capturado em',source:'Referência',formula:'Fórmula',value:'Valor',refs:'Referências',control:'Total de controle',imported:'Total convertido',disposition:'Tratamento',chave:'Chave fiscal',cancelada:'Cancelada',status_sefaz:'Status SEFAZ',source_id:'Identificador original'};
Object.assign(kinds,{juros_simulados:'Juros simulados (não realizados)',aporte_referencia:'Aportes históricos de referência',consumo_credito_permuta:'Consumo de créditos e permutas',transferencia_referencia:'Transferências entre empresas e sócios'});
Object.assign(labels,{planilha:'Controle da planilha',efd:'Receita fiscal EFD',notas_saida:'Notas de saída',quantidade_notas:'Quantidade de notas',diferenca_planilha_efd:'Diferença planilha − EFD',diferenca_planilha_notas:'Diferença planilha − notas',previsto:'Previsto',informado:'Informado',diferenca:'Diferença',scope:'Escopo',pis:'PIS',cofins:'COFINS',arquivo:'Arquivo'});
const monetaryKeys=new Set(['planilha','efd','notas_saida','diferenca_planilha_efd','diferenca_planilha_notas','previsto','informado','diferenca','pis','cofins','control','imported']);
function Details({data}:{data:Record<string,unknown>}) { return <dl className={styles.details}>{Object.entries(data).filter(([,v])=>v!==undefined).map(([k,v])=><div key={k}><dt>{labels[k]??k}</dt><dd>{v===null?'Não informado':monetaryKeys.has(k)&&typeof v==='number'?brl(v):Array.isArray(v)?v.join(' · '):typeof v==='object'?JSON.stringify(v):String(v)}</dd></div>)}</dl>; }

export default async function OrkPage({params,searchParams}:{params:Promise<{section:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const [{section},rawSearch,unit]=await Promise.all([params,searchParams,getCurrentUnit()]);
 const sp:Record<string,string|undefined>=Object.fromEntries(Object.entries(rawSearch).map(([k,v])=>[k,Array.isArray(v)?v[0]:v]));
 if(!Object.hasOwn(ORK_SECTIONS,section)) notFound();
 if(!unit||!isReconciliationUnit(unit)) return <div><h1>Restaurante Ork</h1><p>Selecione Restaurante Ork no seletor de unidades para abrir a conciliação. A Marena permanece com seus dados originais.</p></div>;
 const area=section as OrkSection, db=await createFinanceiroClient();
 const mainSections=Object.entries(ORK_SECTIONS).filter(([key])=>!key.startsWith('dre-'));
 const SectionNav=()=> <nav className={styles.tabs} aria-label="Áreas de conciliação">{mainSections.map(([key,label])=><Link key={key} href={`/financeiro/ork/${key}`} aria-current={key===area||key==='dre'&&area.startsWith('dre')?'page':undefined}>{label}</Link>)}</nav>;
 if(area==='revisao') return <div className={styles.page}><PageHeading title="Revisão de registros" eyebrow="Restaurante Ork · Conciliação" description="Natureza e CC da planilha, com revisão auditável por evidência."/><SectionNav/><ReviewPage unitId={unit.id} sp={sp}/></div>;
 if(area==='receita') return <div className={styles.page}><PageHeading title="Receita" eyebrow="Restaurante Ork" description="Faturamento diário da planilha, separado por turno e forma de pagamento."/><SectionNav/><RevenuePage unitId={unit.id} sp={sp}/></div>;
 if(['despesas','cartoes','caixa','socios','investimentos','orcamento','documentos'].includes(area)) return <div className={styles.page}><PageHeading title={ORK_SECTIONS[area]} eyebrow="Restaurante Ork" description="Visão por período com os detalhes preservados da fonte."/><SectionNav/><MonthlyAreaPage unitId={unit.id} area={area} sp={sp}/></div>;
 if(area.startsWith('dre')) return <div className={styles.page}><PageHeading title={ORK_SECTIONS[area]} eyebrow="Restaurante Ork" description="Organização gerencial preliminar pelos CCs informados na planilha."/><SectionNav/><DrePage unitId={unit.id} section={area} sp={sp}/></div>;
 const period=sp.period&&/^20\d{2}-(0[1-9]|1[0-2])$/.test(sp.period)?sp.period:null;
 let from=sp.from&&/^20\d{2}-(0[1-9]|1[0-2])$/.test(sp.from)?sp.from:period;
 let to=sp.to&&/^20\d{2}-(0[1-9]|1[0-2])$/.test(sp.to)?sp.to:period;
 if(from&&to&&from>to) [from,to]=[to,from];
 const page=Math.min(10000,Math.max(1,Number.parseInt(sp.page??'1',10)||1)),size=60;
 const query=sp.q?.trim().slice(0,100)??'';
 const source=['planilha','nfe','efd'].includes(sp.source??'')?sp.source:null;
 const {data:imports,error:importError}=await db.from('ork_imports').select('id,filename,created_at,manifest,status').eq('unit_id',unit.id).eq('status','ready').order('created_at',{ascending:false});
 if(importError) throw new Error(importError.message);
 const importIds=(imports??[]).map(i=>i.id);
 let rows:Evidence[]=[],issues:Issue[]=[],decisions:Decision[]=[],count=0,totals:{source:string;kind:string;records:number;amount:number|null}[]=[];
 if(area==='inteligencia') {
  let request=db.from('ork_issues').select('*',{count:'exact'}).eq('unit_id',unit.id).order('severity').order('created_at').order('id');
  if(from&&to) request=request.or(`period.is.null,and(period.gte.${from},period.lte.${to})`);
  const {data,error,count:n}=await request.range((page-1)*size,page*size-1);
  if(error) throw new Error(error.message);
  issues=data??[];count=n??0;
  if(issues.length) {
   const {data:ds,error:de}=await db.from('ork_issue_decisions').select('issue_id,status,explanation,created_at').eq('unit_id',unit.id).in('issue_id',issues.map(i=>i.id)).order('created_at',{ascending:false}).limit(1000);
   if(de) throw new Error(de.message); decisions=ds??[];
  }
 } else if(importIds.length) {
  let request=db.from('ork_evidence').select('*',{count:'exact'}).eq('unit_id',unit.id).in('import_id',importIds).eq('area',area).order('occurred_on',{ascending:false,nullsFirst:false}).order('id');
  if(period) request=request.eq('period',period);
  if(source) request=request.eq('source',source);
  if(query) request=request.ilike('description',`%${query.replace(/[%_\\]/g,'')}%`);
  const [{data,error,count:n},{data:ts,error:te}]=await Promise.all([request.range((page-1)*size,page*size-1),db.rpc('ork_totals',{p_unit:unit.id,p_area:area,p_period:period})]);
  if(error||te) throw new Error(error?.message??te?.message);
  rows=data??[];count=n??0;totals=ts??[];
 }
 const href=(p:number)=>`?${new URLSearchParams({...Object.fromEntries(Object.entries(sp).filter((entry):entry is [string,string]=>typeof entry[1]==='string')),page:String(p)})}`;
 return <div className={styles.page}>
  <PageHeading title={ORK_SECTIONS[area]} eyebrow="Restaurante Ork · Conciliação" description="Evidências da planilha e da contabilidade preservadas. Fora do consolidado do grupo; nenhuma DRE homologada." />
  <p className={styles.notice}>Em validação. Os valores de fontes diferentes não são somados entre si. Resolver uma pergunta não confirma automaticamente um lançamento financeiro.</p>
  <SectionNav/>
  <form className={styles.filters}>
   <label>Período de<input type="month" name="from" defaultValue={from??''}/></label><label>Até<input type="month" name="to" defaultValue={to??''}/></label>
   {area!=='inteligencia'&&<><label>Origem<select name="source" defaultValue={source??''}><option value="">Todas (separadas)</option><option value="planilha">Planilha</option><option value="nfe">Notas fiscais</option><option value="efd">EFD</option></select></label><label>Descrição<input name="q" defaultValue={query} placeholder="Buscar descrição"/></label></>}
   <button className="maza-button" type="submit">Filtrar</button><Link href={`/financeiro/ork/${area}`}>Limpar</Link>
  </form>
  {totals.length>0&&<section className={styles.panel}><h2>Referências do período</h2><p>Totais completos do período, independentes da busca por descrição. Categorias e bases distintas não formam um total único.</p><div className={styles.summaries}>{totals.filter(t=>!source||t.source===source).map(t=><div key={`${t.source}:${t.kind}`}><span>{t.source.toUpperCase()} · {kinds[t.kind]??t.kind}</span><strong>{brl(t.amount)}</strong><small>{Number(t.records).toLocaleString('pt-BR')} registros</small></div>)}</div></section>}
  {area==='inteligencia'?<>
   <section className={styles.panel}><h2>Fontes e cobertura</h2>{imports?.length?imports.map(i=><details key={i.id}><summary>{i.filename} · {new Date(i.created_at).toLocaleDateString('pt-BR')} · Ver cobertura</summary><ul>{(i.manifest?.sheets??[]).map((s:{name:string;records:number;hidden:boolean;disposition:string})=><li key={s.name}><strong>{s.name}{s.hidden?' (oculta)':''}</strong> · {s.records} registros. {s.disposition}</li>)}</ul></details>):<p>Importação ainda em preparação. Nenhuma base parcial é apresentada como concluída.</p>}</section>
   <section className={styles.panel}><h2>Pendências por registro</h2><p>As perguntas individuais e as possíveis duplicidades ficam na revisão, com a evidência e seu histórico.</p><nav className={styles.tabs}><Link href="/financeiro/ork/revisao?status=aguardando_cliente">Perguntas para o cliente</Link><Link href="/financeiro/ork/revisao?status=possivel_duplicidade">Possíveis duplicidades</Link><Link href="/financeiro/ork/revisao?status=pendente">A revisar</Link></nav></section>
   <h2>Perguntas e divergências · {count}</h2>
   {issues.map(issue=>{const history=decisions.filter(d=>d.issue_id===issue.id),latest=history[0];return <article key={issue.id} className={styles.panel}>
    <div className={styles.issueHeader}><h3>{issue.title}</h3><span>{latest?.status.replaceAll('_',' ')??'aberto'} · {issue.severity}</span></div><p>{issue.question}</p>
    {Object.keys(issue.evidence).length>0&&<details><summary>Ver evidências</summary><Details data={issue.evidence}/></details>}
    <details><summary>Registrar resposta ou acompanhamento</summary><form action={recordDecision} className={styles.decision}>
     <input type="hidden" name="issue_id" value={issue.id}/><label>Situação<select name="status" defaultValue={latest?.status??'aguardando_cliente'}><option value="aberto">Aberto</option><option value="aguardando_cliente">Aguardando cliente</option><option value="resolvido">Resolvido com explicação</option></select></label>
     <label>Explicação e referência do comprovante<textarea name="explanation" minLength={5} maxLength={5000} required rows={3}/></label><button type="submit" className="maza-button">Registrar no histórico</button>
    </form>{history.map((d,index)=><p key={index}>{new Date(d.created_at).toLocaleString('pt-BR')} · {d.status.replaceAll('_',' ')}: {d.explanation}</p>)}</details>
   </article>})}
  </>:<section className={styles.panel}>
   <h2>Registros de origem · {count.toLocaleString('pt-BR')}</h2>
   <p>A data e a categoria são as informadas pela fonte; não comprovam pagamento ou classificação contábil.</p>
   <div className={styles.tableWrap}><table><thead><tr><th>Data informada</th><th>Descrição / fornecedor</th><th>Categoria original</th><th>Valor</th><th>Origem e rastreio</th></tr></thead><tbody>
    {rows.map(r=><tr key={r.id}><td>{r.occurred_on?.split('-').reverse().join('/')??'Não informada'}</td><td>{r.description}{r.entity&&<small>{r.entity}</small>}<small>{kinds[r.kind]??r.kind}</small></td><td>{r.category_original??'A classificar'}</td><td className={styles.money}>{brl(r.amount)}</td><td><details><summary>{r.source.toUpperCase()}</summary><p>{r.source_ref}</p><Details data={r.details}/></details></td></tr>)}
    {!rows.length&&<tr><td colSpan={5}>Nenhum registro para este filtro. Veja a cobertura e as pendências na Inteligência.</td></tr>}
   </tbody></table></div>
  </section>}
  <nav className={styles.pagination} aria-label="Paginação">{page>1&&<Link href={href(page-1)}>← Anterior</Link>}<span>Página {page} de {Math.max(1,Math.ceil(count/size))}</span>{page*size<count&&<Link href={href(page+1)}>Próxima →</Link>}</nav>
 </div>;
}
