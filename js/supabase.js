// Configuração automática baseada nos dados fornecidos
// ID do Projeto extraído: vfryefavzurwoiuznkwv
const SUPABASE_URL = 'https://vfryefavzurwoiuznkwv.supabase.co';

// Chave Pública (ANON KEY) - Segura para usar no navegador
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmcnllZmF2enVyd29pdXpua3d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MjI5MjQsImV4cCI6MjA4MDE5ODkyNH0.B8kUGDsCBBre-ZmbBqrfP3s-EEFqaEpyHPurE7cm8VY';

// Inicializa o cliente Supabase
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
