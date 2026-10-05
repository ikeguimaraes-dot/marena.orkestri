import { createClient } from '@supabase/supabase-js';
const email = process.argv[2];
const password = process.env.MARENA_ADMIN_PASSWORD;
if (!email || !password || password.length < 12) throw new Error('Informe o e-mail e MARENA_ADMIN_PASSWORD com pelo menos 12 caracteres.');
if (process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://hneehjanflbyajrpsdpf.supabase.co') throw new Error('Este script só pode administrar o projeto Marena.');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const [{data:role,error:roleError},{data:group,error:groupError}] = await Promise.all([
 db.from('roles').select('id').eq('name','founder').single(),
 db.from('groups').select('id').eq('slug','marena').single(),
]);
if(roleError||groupError) throw new Error('Execute as migrações iniciais antes de criar o administrador.');
const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:'Administrador Marena'}});
if(error) throw error;
try {
 const {error:grantError}=await db.from('user_roles').insert({user_id:data.user.id,role_id:role.id,group_id:group.id});
 if(grantError) throw grantError;
 console.log('Administrador criado e vinculado ao grupo Marena. Nenhum e-mail foi enviado.');
} catch(error) {
 const {error:cleanupError}=await db.auth.admin.deleteUser(data.user.id);
 if(cleanupError) console.error('Falha ao remover usuário sem permissão:',data.user.id);
 throw error;
}
