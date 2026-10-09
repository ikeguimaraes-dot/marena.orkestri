// Generates SQL for the audited Supabase connector. No credentials or network access.
import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const mode=process.argv[3], offset=Number(process.argv[4]??0),limit=Number(process.argv[5]??300);
const quote=x=>`'${String(x).replaceAll("'","''")}'`;
const target="select id from public.units where name='Restaurante Ork' and reconciliation_source_unit_id is not null";
const current=`select id from public.ork_imports where unit_id=(${target}) and checksum=${quote(data.checksum)} and parser_version=${quote(data.parser_version)}`;
if(mode==='init') console.log(`insert into public.ork_imports(unit_id,filename,checksum,parser_version,manifest) select id,'Painel de Controle - 2025 e 2026.xlsx',${quote(data.checksum)},${quote(data.parser_version)},${quote(JSON.stringify(data.manifest))}::jsonb from public.units where id=(${target}) on conflict(unit_id,checksum,parser_version) do nothing;`);
else if(mode==='rows') console.log(`insert into public.ork_evidence(unit_id,import_id,source,source_ref,area,kind,occurred_on,period,description,entity,amount,category_original,details) select (${target}),(${current}),r.* from jsonb_to_recordset(${quote(JSON.stringify(data.rows.slice(offset,offset+limit)))}::jsonb) as r(source text,source_ref text,area text,kind text,occurred_on date,period text,description text,entity text,amount numeric,category_original text,details jsonb) on conflict(unit_id,import_id,source_ref) do nothing;`);
else if(mode==='issues') console.log(`insert into public.ork_issues(unit_id,issue_key,title,question,evidence,period,severity) select (${target}),r.* from jsonb_to_recordset(${quote(JSON.stringify(data.issues))}::jsonb) as r(issue_key text,title text,question text,evidence jsonb,period text,severity text) on conflict(unit_id,issue_key) do nothing;`);
else if(mode==='finalize') console.log(`do $$ begin if (select count(*) from public.ork_evidence where import_id=(${current}))<>${data.rows.length} then raise exception 'Importação incompleta'; end if; update public.ork_imports set status='ready' where id=(${current}); end $$; select count(*) as records from public.ork_evidence where import_id=(${current});`);
else throw new Error('Modo inválido');
