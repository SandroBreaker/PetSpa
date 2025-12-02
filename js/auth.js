
import { supabase } from './supabase.js';

/**
 * Realiza o login do usuário
 */
export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    
    if (error) throw error;
    return data;
}

/**
 * Realiza o cadastro de novo usuário
 * Aceita role opcional (padrão 'client') para permitir criação de funcionários
 */
export async function signUp(email, password, fullName, phone, role = 'client') {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
                phone: phone,
                role: role // Envia o cargo nos metadados
            },
            // Garante que o link do email volte para a URL atual (localhost, IP ou domínio real)
            emailRedirectTo: window.location.origin
        }
    });

    if (error) throw error;
    return data;
}

/**
 * Realiza o logout
 */
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}
