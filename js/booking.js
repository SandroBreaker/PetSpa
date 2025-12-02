

import { supabase } from './supabase.js';

/**
 * Busca lista de serviços ativos
 */
export async function getServices() {
    const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('active', true)
        .order('price', { ascending: true }); // Ordenado por preço para melhor UX
        
    if (error) throw error;
    return data || [];
}

/**
 * Busca os pets do usuário logado
 */
export async function getMyPets() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    const { data, error } = await supabase
        .from('pets')
        .select('*')
        .eq('owner_id', user.id);

    if (error) throw error;
    return data || [];
}

/**
 * Busca TODOS os pets (apenas para Admin)
 */
export async function getAllPets() {
    const { data, error } = await supabase.from('pets').select('id, name, owner_id');
    if(error) throw error;
    return data || [];
}

/**
 * Busca um agendamento específico com detalhes (Para o Tracker)
 */
export async function getAppointmentById(id) {
    const { data, error } = await supabase
        .from('appointments')
        .select('*, pets(name, breed), services(name)')
        .eq('id', id)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Busca TODOS os agendamentos em um intervalo (para o Calendário)
 * Retorna dados necessários para verificar colisão
 */
export async function getAppointmentsForRange(startDate, endDate) {
    const { data, error } = await supabase
        .from('appointments')
        .select(`
            id, start_time, end_time, status,
            pets (name),
            profiles (full_name)
        `)
        .gte('start_time', startDate.toISOString())
        .lte('end_time', endDate.toISOString())
        .neq('status', 'cancelled');

    if (error) throw error;
    return data || [];
}

/**
 * Atualiza um agendamento completo (Admin)
 */
export async function updateAppointmentFull(id, payload) {
    const { error } = await supabase
        .from('appointments')
        .update(payload)
        .eq('id', id);
    if (error) throw error;
    return true;
}

/**
 * Cria um novo agendamento
 */
export async function createAppointment(petId, serviceId, startIso, endIso) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.from('appointments').insert({
        client_id: user.id,
        pet_id: petId,
        service_id: serviceId,
        start_time: startIso,
        end_time: endIso,
        status: 'pending'
    });

    if (error) throw error;
    return true;
}

/**
 * Cria um novo Pet (Necessário para o fluxo inicial do cliente)
 */
export async function createPet(name, breed, weight, notes) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.from('pets').insert({
        owner_id: user.id,
        name: name,
        breed: breed,
        weight: parseFloat(weight) || 0,
        notes: notes
    });

    if (error) throw error;
    return true;
}

/**
 * Busca perfis de funcionários (Admin)
 */
export async function getEmployees() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['admin', 'employee']);
    if (error) throw error;
    return data || [];
}

/**
 * Cria o registro técnico do funcionário na tabela employees
 * Necessário para satisfazer a Chave Estrangeira
 */
export async function createEmployeeRecord(userId) {
    // Verifica se já existe para não duplicar erro
    const { data } = await supabase.from('employees').select('id').eq('id', userId).single();
    if (data) return;

    const { error } = await supabase.from('employees').insert({
        id: userId,
        specialties: ['Geral'], // Valor padrão
        active: true
    });
    
    if (error) console.error('Erro ao criar registro de employees:', error);
}

/**
 * Cria um novo Produto no Marketplace (Admin)
 */
export async function createProduct(productData) {
    const { error } = await supabase.from('products').insert(productData);
    if (error) throw error;
    return true;
}