'use client';
import Link from 'next/link';
import type {PeriodRange} from '@/lib/ork/period';
import styles from './page.module.css';

export function PeriodFilter({range,clearHref,children,emptyRange=false}:{range:PeriodRange;clearHref:string;children?:React.ReactNode;emptyRange?:boolean}){
 const coordinate=(event:React.ChangeEvent<HTMLFormElement>)=>{
  const target=event.target as unknown as HTMLInputElement|HTMLSelectElement;
  const form=event.currentTarget;
  if(target.name==='month'&&target.value){for(const name of ['from','to']){const field=form.elements.namedItem(name) as HTMLInputElement|null;if(field) field.value='';}}
  if((target.name==='from'||target.name==='to')&&target.value){const month=form.elements.namedItem('month') as HTMLInputElement|HTMLSelectElement|null;if(month) month.value='';}
 };
 return <form className={styles.periodFilter} onChange={coordinate}>
  <label>De<input type="month" name="from" defaultValue={emptyRange?'':range.from}/></label>
  <label>Até<input type="month" name="to" defaultValue={emptyRange?'':range.to}/></label>
  {children}
  <button className="maza-button" type="submit">Filtrar período</button>
  <Link href={clearHref}>Limpar</Link>
 </form>;
}
