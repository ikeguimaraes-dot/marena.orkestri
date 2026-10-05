import { readdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const forbidden = [/https:\/\/maza[^\s"'`]*\.vercel\.app/i, /674eac8c-5a38-4a42-aa60-0a666387909[bc]/, /eyJhbGciOi/];
async function scan(dir) {
 for (const entry of await readdir(dir,{withFileTypes:true})) {
  if (['node_modules','.next','.git','.turbo'].includes(entry.name)||entry.name.startsWith('.env')) continue;
  const path=`${dir}/${entry.name}`;
  if(entry.isDirectory()) await scan(path);
  else if (/\.(ts|tsx|js|mjs|html|sql|json)$/.test(path)&&!path.endsWith('package-lock.json')) {
   const body=await readFile(path,'utf8');
   for(const pattern of forbidden) assert.ok(!pattern.test(body),`Referência do cliente anterior ou credencial em ${path}`);
   for (const url of body.matchAll(/https:\/\/([a-z]{20})\.supabase\.co/g)) assert.equal(url[1],'hneehjanflbyajrpsdpf',`Outro Supabase em ${path}`);
  }
 }
}
for(const dir of ['apps','packages','supabase']) await scan(dir);
console.log('Isolamento: nenhum endpoint antigo, ID de unidade antigo ou JWT embutido.');
