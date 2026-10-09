import Link from 'next/link';
import type {PeriodRange} from '@/lib/ork/period';
import styles from './page.module.css';

export function PeriodFilter({range,clearHref,children}:{range:PeriodRange;clearHref:string;children?:React.ReactNode}){
 return <form className={styles.periodFilter}>
  <label>De<input type="month" name="from" defaultValue={range.from}/></label>
  <label>Até<input type="month" name="to" defaultValue={range.to}/></label>
  {children}
  <button className="maza-button" type="submit">Filtrar período</button>
  <Link href={clearHref}>Limpar</Link>
 </form>;
}

