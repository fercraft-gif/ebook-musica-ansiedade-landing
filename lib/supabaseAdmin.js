// /lib/supabaseAdmin.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_LANDING_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_LANDING_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'ERRO: Variáveis SUPABASE_LANDING_SUPABASE_URL ou SUPABASE_LANDING_SUPABASE_SERVICE_ROLE_KEY não configuradas.'
  );
  throw new Error('Env SUPABASE faltando');
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);