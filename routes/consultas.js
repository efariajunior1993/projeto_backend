const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const authorize = require('../middleware/authorize'); // Importe o middleware de autorização

// Definir os tipos de usuário (IDs da tabela tipo_usuario)
const USER_TYPE_ADMIN = 1;
const USER_TYPE_MEDICO = 2;
const USER_TYPE_ENFERMEIRO = 3;
const USER_TYPE_PACIENTE = 4;

// GET /api/consultas - Listar todas as consultas
// Admin, Médico e Enfermeiro podem ver todas as consultas
router.get('/', authorize([USER_TYPE_ADMIN, USER_TYPE_MEDICO, USER_TYPE_ENFERMEIRO]), async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                c.id,
                c.data,
                tc.tipo as tipo_consulta,
                c.descricao,
                p.nome as paciente_nome,
                p.cpf as paciente_cpf,
                prof.nome as profissional_nome,
                em.especialidade as especialidade,
                car.cargo as profissional_tipo
            FROM consultas c
            INNER JOIN pacientes p ON c.paciente_id = p.id
            INNER JOIN profissionais prof ON c.profissional_id = prof.id
            INNER JOIN tipos_consulta tc ON tc.id = c.tipo
            INNER JOIN especialidades_medicas em ON em.id = prof.especialidade
            INNER JOIN cargos car ON car.id = prof.cargo
            ORDER BY c.data DESC
        `);
        
        res.json({
            success: true,
            data: rows,
            total: rows.length
        });
    } catch (error) {
        console.error('Erro ao buscar consultas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// GET /api/consultas/:id - Buscar consulta por ID
// Admin, Médico, Enfermeiro podem ver qualquer consulta. Paciente pode ver apenas as suas.
router.get('/:id', authorize([USER_TYPE_ADMIN, USER_TYPE_MEDICO, USER_TYPE_ENFERMEIRO, USER_TYPE_PACIENTE]), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userType = req.user.tipo;

        let query = `
            SELECT 
                c.id,
                c.data,
                tc.tipo as tipo_consulta,
                c.descricao,
                p.nome as paciente_nome,
                p.cpf as paciente_cpf,
                prof.nome as profissional_nome,
                em.especialidade as especialidade,
                car.cargo as profissional_tipo
            FROM consultas c
            INNER JOIN pacientes p ON c.paciente_id = p.id
            INNER JOIN profissionais prof ON c.profissional_id = prof.id
            INNER JOIN tipos_consulta tc ON tc.id = c.tipo
            INNER JOIN especialidades_medicas em ON em.id = prof.especialidade
            INNER JOIN cargos car ON car.id = prof.cargo
            WHERE c.id = ?
        `;
        let queryParams = [id];

        if (userType === USER_TYPE_PACIENTE) {
            // Se for paciente, ele só pode ver consultas onde ele é o paciente_id
            query += ' AND c.paciente_id = (SELECT id FROM pacientes WHERE id = ?)';
            queryParams.push(userId);
        } else if (userType === USER_TYPE_MEDICO || userType === USER_TYPE_ENFERMEIRO) {
            // Se for médico/enfermeiro, ele só pode ver consultas onde ele é o profissional_id
            query += ' AND c.profissional_id = (SELECT id FROM profissionais WHERE id = ?)';
            queryParams.push(userId);
        }

        const [rows] = await pool.execute(query, queryParams);
        
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Consulta não encontrada ou acesso negado'
            });
        }
        
        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Erro ao buscar consulta:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// POST /api/consultas - Criar nova consulta
// Admin, Médico e Enfermeiro podem criar consultas
router.post('/', authorize([USER_TYPE_ADMIN, USER_TYPE_MEDICO, USER_TYPE_ENFERMEIRO]), async (req, res) => {
    try {
        const { paciente_id, profissional_id, data, tipo, descricao } = req.body;
        const userType = req.user.tipo;
        const userId = req.user.id;
        
        // Validações básicas
        if (!paciente_id || !profissional_id || !data || !tipo) {
            return res.status(400).json({
                success: false,
                message: 'Paciente, profissional, data e tipo são obrigatórios'
            });
        }
        
        // Validar tipo
        const tiposValidos = [1,2];
        if (!tiposValidos.includes(tipo)) {
            return res.status(400).json({
                success: false,
                message: 'Tipo deve ser: 1-Presencial ou 2-Telemedicina'
            });
        }
        
        // Se não for Admin, o profissional_id deve ser o ID do usuário logado
        if (userType !== USER_TYPE_ADMIN && parseInt(profissional_id) !== parseInt(userId)) {
            return res.status(403).json({ success: false, message: 'Acesso negado. Você só pode agendar consultas para si mesmo.' });
        }

        // Verificar se paciente existe
        const [pacienteCheck] = await pool.execute(
            'SELECT id, nome FROM pacientes WHERE id = ?',
            [paciente_id]
        );
        
        if (pacienteCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Paciente não encontrado'
            });
        }
        
        // Verificar se profissional existe
        const [profissionalCheck] = await pool.execute(
            'SELECT id, nome FROM profissionais WHERE id = ?',
            [profissional_id]
        );
        
        if (profissionalCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Profissional não encontrado'
            });
        }
        
        // Verificar se já existe consulta no mesmo horário para o profissional
        const [conflictCheck] = await pool.execute(
            'SELECT id FROM consultas WHERE profissional_id = ? AND data = ?',
            [profissional_id, data]
        );
        
        if (conflictCheck.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Profissional já tem consulta agendada neste horário'
            });
        }
        
        // Inserir nova consulta
        const [result] = await pool.execute(
            'INSERT INTO consultas (paciente_id, profissional_id, data, tipo, descricao) VALUES (?, ?, ?, ?, ?)',
            [paciente_id, profissional_id, data, tipo, descricao]
        );
        
        // Buscar a consulta criada com dados completos
        const [newConsulta] = await pool.execute(`
            SELECT 
                c.id,
                c.data,
                tc.tipo as tipo_consulta,
                c.descricao,
                p.nome as paciente_nome,
                p.cpf as paciente_cpf,
                prof.nome as profissional_nome,
                em.especialidade as especialidade,
                car.cargo as profissional_tipo
            FROM consultas c
            INNER JOIN pacientes p ON c.paciente_id = p.id
            INNER JOIN profissionais prof ON c.profissional_id = prof.id
            INNER JOIN tipos_consulta tc ON tc.id = c.tipo
            INNER JOIN especialidades_medicas em ON em.id = prof.especialidade
            INNER JOIN cargos car ON car.id = prof.cargo
            WHERE c.id = ?
        `, [result.insertId]);
        
        res.status(201).json({
            success: true,
            message: 'Consulta agendada com sucesso',
            data: newConsulta[0]
        });
        
    } catch (error) {
        console.error('Erro ao criar consulta:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// PUT /api/consultas/:id - Atualizar consulta
// Admin, Médico e Enfermeiro podem atualizar consultas
router.put('/:id', authorize([USER_TYPE_ADMIN, USER_TYPE_MEDICO, USER_TYPE_ENFERMEIRO]), async (req, res) => {
    try {
        const { id } = req.params;
        const { paciente_id, profissional_id, data, tipo, descricao } = req.body;
        const userType = req.user.tipo;
        const userId = req.user.id;

        // Validar tipo se fornecido
        if (tipo) {
            const tiposValidos = [1,2];
            if (!tiposValidos.includes(tipo)) {
                return res.status(400).json({
                    success: false,
                    message: 'Tipo deve ser: 1-Presencial ou 2-Telemedicina'
                });
            }
        }
        
        // Verificar se consulta existe
        const [existing] = await pool.execute(
            'SELECT id, profissional_id FROM consultas WHERE id = ?',
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Consulta não encontrada'
            });
        }

        // Se não for Admin, o profissional_id da consulta deve ser o ID do usuário logado
        if (userType !== USER_TYPE_ADMIN && parseInt(existing[0].profissional_id) !== parseInt(userId)) {
            return res.status(403).json({ success: false, message: 'Acesso negado. Você só pode atualizar suas próprias consultas.' });
        }
        
        // Verificar se paciente existe (se fornecido)
        if (paciente_id) {
            const [pacienteCheck] = await pool.execute(
                'SELECT id FROM pacientes WHERE id = ?',
                [paciente_id]
            );
            
            if (pacienteCheck.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Paciente não encontrado'
                });
            }
        }
        
        // Verificar se profissional existe (se fornecido)
        if (profissional_id) {
            const [profissionalCheck] = await pool.execute(
                'SELECT id FROM profissionais WHERE id = ?',
                [profissional_id]
            );
            
            if (profissionalCheck.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Profissional não encontrado'
                });
            }
        }
        
        // Verificar conflito de horário (se data ou profissional mudaram)
        if (data && profissional_id) {
            const [conflictCheck] = await pool.execute(
                'SELECT id FROM consultas WHERE profissional_id = ? AND data = ? AND id != ?',
                [profissional_id, data, id]
            );
            
            if (conflictCheck.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Profissional já tem consulta agendada neste horário'
                });
            }
        }
        
        // Atualizar consulta
        await pool.execute(
            'UPDATE consultas SET paciente_id = ?, profissional_id = ?, data = ?, tipo = ?, descricao = ? WHERE id = ?',
            [paciente_id, profissional_id, data, tipo, descricao, id]
        );
        
        // Buscar consulta atualizada
        const [updated] = await pool.execute(`
            SELECT 
                c.id,
                c.data,
                tc.tipo as tipo_consulta,
                c.descricao,
                p.nome as paciente_nome,
                p.cpf as paciente_cpf,
                prof.nome as profissional_nome,
                em.especialidade as especialidade,
                car.cargo as profissional_tipo
            FROM consultas c
            INNER JOIN pacientes p ON c.paciente_id = p.id
            INNER JOIN profissionais prof ON c.profissional_id = prof.id
            INNER JOIN tipos_consulta tc ON tc.id = c.tipo
            INNER JOIN especialidades_medicas em ON em.id = prof.especialidade
            INNER JOIN cargos car ON car.id = prof.cargo
            WHERE c.id = ?
        `, [id]);
        
        res.json({
            success: true,
            message: 'Consulta atualizada com sucesso',
            data: updated[0]
        });
        
    } catch (error) {
        console.error('Erro ao atualizar consulta:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// DELETE /api/consultas/:id - Deletar consulta
// Apenas Admin pode deletar consultas
router.delete('/:id', authorize([USER_TYPE_ADMIN]), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar se consulta existe
        const [existing] = await pool.execute(`
            SELECT 
                c.id,
                c.data,
                p.nome as paciente_nome,
                prof.nome as profissional_nome
            FROM consultas c
            INNER JOIN pacientes p ON c.paciente_id = p.id
            INNER JOIN profissionais prof ON c.profissional_id = prof.id
            WHERE c.id = ?
        `, [id]);
        
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Consulta não encontrada'
            });
        }
        
        
        // Deletar consulta
        await pool.execute('DELETE FROM consultas WHERE id = ?', [id]);
        
        res.json({
            success: true,
            message: 'Consulta deletada com sucesso'
        });
        
    } catch (error) {
        console.error('Erro ao deletar consulta:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// GET /api/consultas/paciente/:paciente_id - Buscar consultas por paciente
// Admin, Médico, Enfermeiro podem ver consultas de qualquer paciente. Paciente pode ver apenas as suas.
router.get('/paciente/:paciente_id', authorize([USER_TYPE_ADMIN, USER_TYPE_MEDICO, USER_TYPE_ENFERMEIRO, USER_TYPE_PACIENTE]), async (req, res) => {
    try {
        const { paciente_id } = req.params;
        const userId = req.user.id;
        const userType = req.user.tipo;

        // Se o usuário for um paciente, ele só pode ver as próprias consultas
        if (userType === USER_TYPE_PACIENTE && parseInt(paciente_id) !== parseInt(userId)) {
            return res.status(403).json({ success: false, message: 'Acesso negado. Você só pode ver suas próprias consultas.' });
        }
        
        const [rows] = await pool.execute(`
            SELECT 
                c.id,
                c.data,
                tc.tipo as tipo_consulta,
                c.descricao,
                p.nome as paciente_nome,
                p.cpf as paciente_cpf,
                prof.nome as profissional_nome,
                em.especialidade as especialidade,
                car.cargo as profissional_tipo
            FROM consultas c
            INNER JOIN pacientes p ON c.paciente_id = p.id
            INNER JOIN profissionais prof ON c.profissional_id = prof.id
            INNER JOIN tipos_consulta tc ON tc.id = c.tipo
            INNER JOIN especialidades_medicas em ON em.id = prof.especialidade
            INNER JOIN cargos car ON car.id = prof.cargo
            WHERE c.paciente_id = ?
            ORDER BY c.data DESC
        `, [paciente_id]);
        
        res.json({
            success: true,
            data: rows,
            total: rows.length,
            paciente_id: paciente_id
        });
        
    } catch (error) {
        console.error('Erro ao buscar consultas do paciente:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// GET /api/consultas/profissional/:profissional_id - Buscar consultas por profissional
// Admin, Médico, Enfermeiro podem ver consultas de qualquer profissional. Profissional pode ver apenas as suas.
router.get('/profissional/:profissional_id', authorize([USER_TYPE_ADMIN, USER_TYPE_MEDICO, USER_TYPE_ENFERMEIRO]), async (req, res) => {
    try {
        const { profissional_id } = req.params;
        const userId = req.user.id;
        const userType = req.user.tipo;

        // Se não for Admin, o profissional_id na URL deve ser o ID do usuário logado
        if (userType !== USER_TYPE_ADMIN && parseInt(profissional_id) !== parseInt(userId)) {
            return res.status(403).json({ success: false, message: 'Acesso negado. Você só pode ver suas próprias consultas.' });
        }
        
        const [rows] = await pool.execute(`
            SELECT 
                c.id,
                c.data,
                tc.tipo as tipo_consulta,
                c.descricao,
                p.nome as paciente_nome,
                p.cpf as paciente_cpf,
                prof.nome as profissional_nome,
                em.especialidade as especialidade,
                car.cargo as profissional_tipo
            FROM consultas c
            INNER JOIN pacientes p ON c.paciente_id = p.id
            INNER JOIN profissionais prof ON c.profissional_id = prof.id
            INNER JOIN tipos_consulta tc ON tc.id = c.tipo
            INNER JOIN especialidades_medicas em ON em.id = prof.especialidade
            INNER JOIN cargos car ON car.id = prof.cargo
            WHERE c.profissional_id = ?
            ORDER BY c.data DESC
        `, [profissional_id]);
        
        res.json({
            success: true,
            data: rows,
            total: rows.length,
            profissional_id: profissional_id
        });
        
    } catch (error) {
        console.error('Erro ao buscar consultas do profissional:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

module.exports = router;