// lib/supabaseAdmin.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_LANDING_SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERRO: Variáveis SUPABASE não configuradas.');
  throw new Error('Env SUPABASE faltando');
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);