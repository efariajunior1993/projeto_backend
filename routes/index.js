const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware'); // Importe o middleware de autenticação
const authorize = require('../middleware/authorize'); // Importe o novo middleware de autorização

// Definir os tipos de usuário (IDs da tabela tipo_usuario)
const USER_TYPE_ADMIN = 1;
const USER_TYPE_MEDICO = 2;
const USER_TYPE_ENFERMEIRO = 3;
const USER_TYPE_PACIENTE = 4;

// Importar todas as rotas
const pacientesRoutes = require('./pacientes');
const profissionaisRoutes = require('./profissionais');
const consultasRoutes = require('./consultas');
const prontuariosRoutes = require('./prontuarios');

// Aplicar o middleware de autenticação a todas as rotas abaixo de /api
// e o middleware de autorização com as permissões apropriadas.

// Rotas de Pacientes
router.use('/pacientes', authMiddleware, pacientesRoutes);

// Rotas de Profissionais
router.use('/profissionais', authMiddleware, profissionaisRoutes);

// Rotas de Consultas
router.use('/consultas', authMiddleware, consultasRoutes);

// Rotas de Prontuários
router.use('/prontuarios', authMiddleware, prontuariosRoutes);

module.exports = router;


// // Rota de informações da API
// router.get('/', (req, res) => {
//     res.json({
//         message: 'API do Sistema de Gestão Hospitalar - SGHSS',
//         version: '1.0.0',
//         endpoints: {
//             pacientes: '/api/pacientes',
//             profissionais: '/api/profissionais',
//             // consultas: '/api/consultas',
//             // prontuarios: '/api/prontuarios',
//             // prescricoes: '/api/prescricoes',
//             // leitos: '/api/leitos',
//             // internacoes: '/api/internacoes'
//         },
//         // documentation: {
//         //     pacientes: {
//         //         'GET /api/pacientes': 'Listar todos os pacientes',
//         //         'GET /api/pacientes/:id': 'Buscar paciente por ID',
//         //         'POST /api/pacientes': 'Criar novo paciente',
//         //         'PUT /api/pacientes/:id': 'Atualizar paciente',
//         //         'DELETE /api/pacientes/:id': 'Deletar paciente',
//         //         'GET /api/pacientes/search/:termo': 'Buscar por nome ou CPF'}
//         //     profissionais: {
//         //         'GET /api/profissionais': 'Listar todos os profissionais',
//         //         'GET /api/profissionais?tipo=Médico': 'Filtrar por tipo',
//         //         'GET /api/profissionais?especialidade=Cardiologia': 'Filtrar por especialidade',
//         //         'GET /api/profissionais/:id': 'Buscar profissional por ID',
//         //         'POST /api/profissionais': 'Criar novo profissional',
//         //         'PUT /api/profissionais/:id': 'Atualizar profissional',
//         //         'DELETE /api/profissionais/:id': 'Deletar profissional',
//         //         'GET /api/profissionais/search/:termo': 'Buscar por nome ou especialidade',
//         //         'GET /api/profissionais/tipos/estatisticas': 'Estatísticas por tipo'}
            
//         // }
//     });
// });