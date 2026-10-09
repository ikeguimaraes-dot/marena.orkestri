import {hojeSaoPaulo} from '@/lib/financeiro/dates';

export type PeriodRange={from:string;to:string};

const valid=(value:string|undefined)=>/^20\d{2}-(0[1-9]|1[0-2])$/.test(value??'');

export function periodRange(sp:Record<string,string|undefined>,fallback:string):PeriodRange{
 const legacy=valid(sp.period)?sp.period!:null;
 const requested=valid(`${sp.year??''}-${String(sp.month??'').padStart(2,'0')}`)?`${sp.year}-${String(sp.month).padStart(2,'0')}`:null;
 let from=valid(sp.from)?sp.from!:legacy??requested??fallback;
 let to=valid(sp.to)?sp.to!:legacy??requested??from;
 if(from>to) [from,to]=[to,from];
 return {from,to};
}

export const periodLabel=({from,to}:PeriodRange)=>from===to?formatPeriod(from):`${formatPeriod(from)} a ${formatPeriod(to)}`;
export const formatPeriod=(period:string)=>new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${period}-01T12:00:00Z`));
export const defaultOrkPeriod=(latest:string|null|undefined,now=new Date())=>{
 const current=hojeSaoPaulo(now).slice(0,7);
 return latest&&latest<current?latest:current;
};
