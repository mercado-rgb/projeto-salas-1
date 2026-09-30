// =====================================================================
// CONFIGURAÇÃO — arquivo único usado pelo site E pelo servidor.
// =====================================================================

export const HORA_INICIO = 7 * 60;          // 07:00
export const HORA_FIM = 22 * 60;            // 22:00
export const PASSO = 30;                    // blocos de 30 minutos
export const MAX_MIN_SEM_DIRETORIA = 120;   // limite de 2 horas por reserva para quem não é diretoria
export const DIAS_ANTECEDENCIA = 60;        // até quantos dias à frente qualquer pessoa pode reservar
export const DIAS_ANTECEDENCIA_DIRETORIA = 400;
export const MAX_SEMANAS = 53;              // limite de repetições de uma reserva semanal
export const FUSO = 'America/Sao_Paulo';

// Salas reservaveis, com os nomes da planta do Caderno de Projeto (pág. 5).
// apenasDiretoria: só pode ser reservada com a senha da diretoria.
export const SALAS = [
  { id: 'azul',    nome: 'Sala Azul',       apelido: 'Representatividade', prep: 'na', cor: '#0048AA', escura: false, apenasDiretoria: false },
  { id: 'amarela', nome: 'Sala Amarela',    apelido: 'Aperfeiçoamento',    prep: 'na',    cor: '#F5A800', escura: true,  apenasDiretoria: false },
  { id: 'estudos', nome: 'Sala de Estudos', apelido: 'Escritório',         prep: 'na',         cor: '#00A99D', escura: false, apenasDiretoria: false },
  { id: 'copa',    nome: 'Copa',            apelido: 'Profissionalismo',   prep: 'na',   cor: '#ED7A2B', escura: false, apenasDiretoria: false },
  { id: 'cow',     nome: 'Coworking',       apelido: 'Sala grande',        prep: 'no',        cor: '#283069', escura: false, apenasDiretoria: true },
];

export const SALA_POR_ID = Object.fromEntries(SALAS.map(s => [s.id, s]));
