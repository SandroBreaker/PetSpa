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
 * Envia full_name e phone no metadata para o Trigger do banco criar o perfil
 */
export async function signUp(email, password, fullName, phone) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
                phone: phone
            }
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
