import { createClient } from '@supabase/supabase-js';

// Las credenciales se cargan desde variables de entorno (.env)
// Ver .env.example para la plantilla
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials not found. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);