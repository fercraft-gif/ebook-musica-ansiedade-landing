// /lib/supabaseAdmin.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('ERRO: SUPABASE_URL não configurada na Vercel.');
  throw new Error('Env SUPABASE_URL faltando');
}

if (!serviceRoleKey) {
  console.error('ERRO: SUPABASE_SERVICE_ROLE_KEY não configurada na Vercel.');
  throw new Error('Env SUPABASE_SERVICE_ROLE_KEY faltando');
}

// Client com service_role (ignora RLS, uso em rotas de backend)
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
