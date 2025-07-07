const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const authorize = require('../middleware/authorize'); // Importe o middleware de autorização

// Definir os tipos de usuário (IDs da tabela tipo_usuario)
const USER_TYPE_ADMIN = 1;
const USER_TYPE_MEDICO = 2;
const USER_TYPE_ENFERMEIRO = 3;
const USER_TYPE_PACIENTE = 4;

// GET /api/prontuarios - Listar todos os prontuários
// Admin, Médico e Enfermeiro podem ver todos os prontuários
router.get('/', authorize([USER_TYPE_ADMIN, USER_TYPE_MEDICO, USER_TYPE_ENFERMEIRO]), async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                pr.id,
                c.data as data_consulta,
                tc.tipo as tipo_consulta,
                p.nome as paciente_nome,
                p.cpf as paciente_cpf,
                p.email as paciente_email,
                p.telefone as paciente_telefone,
                p.data_nascimento as paciente_nascimento,
                prof.nome as profissional_nome,
                em.especialidade as especialidade,
                car.cargo as profissional_tipo,
                prof.registro_profissional,
                pr.observacoes
            FROM prontuarios pr
            INNER JOIN consultas c on pr.consulta_id = c.id
            INNER JOIN pacientes p ON pr.paciente_id = p.id
            INNER JOIN profissionais prof ON pr.profissional_id = prof.id 
            INNER JOIN tipos_consulta tc ON tc.id = c.tipo
            INNER JOIN especialidades_medicas em ON em.id = prof.especialidade
            INNER JOIN cargos car ON car.id = prof.cargo
            ORDER BY pr.consulta_id DESC
        `);
        
        res.json({
            success: true,
            data: rows,
            total: rows.length
        });
    } catch (error) {
        console.error('Erro ao buscar prontuários:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// GET /api/prontuarios/:id - Buscar prontuário por ID
// Admin, Médico, Enfermeiro podem ver qualquer prontuário. Paciente pode ver apenas o seu.
router.get('/:id', authorize([USER_TYPE_ADMIN, USER_TYPE_MEDICO, USER_TYPE_ENFERMEIRO, USER_TYPE_PACIENTE]), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userType = req.user.tipo;
        
        let query = `
            SELECT 
                pr.id,
                pr.paciente_id,
                pr.profissional_id,
                pr.consulta_id,
                pr.observacoes,
                p.nome as paciente_nome,
                p.cpf as paciente_cpf,
                p.email as paciente_email,
                p.telefone as paciente_telefone,
                p.data_nascimento as paciente_nascimento,
                prof.nome as profissional_nome,
                em.especialidade as especialidade,
                car.cargo as profissional_tipo,
                prof.registro_profissional,
                c.data as consulta_data,
                tc.tipo as tipo_consulta,
                c.descricao as consulta_descricao
            FROM prontuarios pr
            LEFT JOIN pacientes p ON pr.paciente_id = p.id
            LEFT JOIN profissionais prof ON pr.profissional_id = prof.id
            LEFT JOIN consultas c ON pr.consulta_id = c.id
            LEFT JOIN tipos_consulta tc ON tc.id = c.tipo
            LEFT JOIN especialidades_medicas em ON em.id = prof.especialidade
            LEFT JOIN cargos car ON car.id = prof.cargo
            WHERE pr.id = ?
        `;
        let queryParams = [id];

        if (userType === USER_TYPE_PACIENTE) {
            // Se for paciente, ele só pode ver prontuários onde ele é o paciente_id
            query += ' AND pr.paciente_id = (SELECT id FROM pacientes WHERE id = ?)';
            queryParams.push(userId);
        } else if (userType === USER_TYPE_MEDICO || userType === USER_TYPE_ENFERMEIRO) {
            // Se for médico/enfermeiro, ele só pode ver prontuários onde ele é o profissional_id
            query += ' AND pr.profissional_id = (SELECT id FROM profissionais WHERE id = ?)';
            queryParams.push(userId);
        }

        const [rows] = await pool.execute(query, queryParams);
        
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Prontuário não encontrado ou acesso negado'
            });
        }
        
        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Erro ao buscar prontuário:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// POST /api/prontuarios - Criar novo prontuário
// Admin e Médico podem criar prontuários
router.post('/', authorize([USER_TYPE_ADMIN, USER_TYPE_MEDICO]), async (req, res) => {
    try {
        const { 
            paciente_id, 
            profissional_id,
            consulta_id,   
            observacoes 
        } = req.body;
        const userType = req.user.tipo;
        const userId = req.user.id;
        
        // Validações básicas
        if (!paciente_id || !profissional_id) {
            return res.status(400).json({
                success: false,
                message: 'Paciente, profissional e observações são obrigatórios'
            });
        }

        // Se não for Admin, o profissional_id deve ser o ID do usuário logado
        if (userType !== USER_TYPE_ADMIN && parseInt(profissional_id) !== parseInt(userId)) {
            return res.status(403).json({ success: false, message: 'Acesso negado. Você só pode criar prontuários para si mesmo.' });
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
        
        //Verificar se consulta existe (se fornecida)
        if (consulta_id) {
            const [consultaCheck] = await pool.execute(
                'SELECT id FROM consultas WHERE id = ?',
                [consulta_id]
            );
            
            if (consultaCheck.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Consulta não encontrada'
                });
            }
            
            // Verificar se já existe prontuário para esta consulta
            const [prontuarioCheck] = await pool.execute(
                'SELECT id FROM prontuarios WHERE consulta_id = ?',
                [consulta_id]
            );
            
            if (prontuarioCheck.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Já existe um prontuário para esta consulta'
                });
            }
        }
        
        // Inserir novo prontuário
        const [result] = await pool.execute(
            'INSERT INTO prontuarios (paciente_id, profissional_id, consulta_id, observacoes) VALUES (?, ?, ?, ?)',
            [paciente_id, profissional_id, consulta_id, observacoes]
        );
        
        // Buscar o prontuário criado com dados completos
        const [newProntuario] = await pool.execute(`
            SELECT 
                pr.id,
                c.data as data_consulta,
                tc.tipo as tipo_consulta,
                p.nome as paciente_nome,
                p.cpf as paciente_cpf,
                p.email as paciente_email,
                p.telefone as paciente_telefone,
                p.data_nascimento as paciente_nascimento,
                prof.nome as profissional_nome,
                em.especialidade as especialidade,
                car.cargo as profissional_tipo,
                prof.registro_profissional,
                pr.observacoes
            FROM prontuarios pr
            INNER JOIN consultas c on pr.consulta_id = c.id
            INNER JOIN pacientes p ON pr.paciente_id = p.id
            INNER JOIN profissionais prof ON pr.profissional_id = prof.id 
            INNER JOIN tipos_consulta tc ON tc.id = c.tipo
            INNER JOIN especialidades_medicas em ON em.id = prof.especialidade
            INNER JOIN cargos car ON car.id = prof.cargo
            WHERE pr.id = ?
        `, [result.insertId]);
        
        res.status(201).json({
            success: true,
            message: 'Prontuário criado com sucesso',
            data: newProntuario[0]
        });
        
    } catch (error) {
        console.error('Erro ao criar prontuário:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// PUT /api/prontuarios/:id - Atualizar prontuário
// Admin e Médico podem atualizar prontuários
router.put('/:id', authorize([USER_TYPE_ADMIN, USER_TYPE_MEDICO]), async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            paciente_id, 
            profissional_id, 
            consulta_id,  
            observacoes 
        } = req.body;
        const userType = req.user.tipo;
        const userId = req.user.id;
        
        // Verificar se prontuário existe
        const [existing] = await pool.execute(
            'SELECT id, profissional_id FROM prontuarios WHERE id = ?',
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Prontuário não encontrado'
            });
        }

        // Se não for Admin, o profissional_id do prontuário deve ser o ID do usuário logado
        if (userType !== USER_TYPE_ADMIN && parseInt(existing[0].profissional_id) !== parseInt(userId)) {
            return res.status(403).json({ success: false, message: 'Acesso negado. Você só pode atualizar seus próprios prontuários.' });
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
        
        // Verificar se consulta existe (se fornecida)
        if (consulta_id) {
            const [consultaCheck] = await pool.execute(
                'SELECT id FROM consultas WHERE id = ?',
                [consulta_id]
            );
            
            if (consultaCheck.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Consulta não encontrada'
                });
            }
            
            // Verificar se já existe outro prontuário para esta consulta
            const [prontuarioCheck] = await pool.execute(
                'SELECT id FROM prontuarios WHERE consulta_id = ? AND id != ?',
                [consulta_id, id]
            );
            
            if (prontuarioCheck.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Já existe um prontuário para esta consulta'
                });
            }
        }
        
        // Atualizar prontuário
        await pool.execute(
            'UPDATE prontuarios SET paciente_id = ?, profissional_id = ?, consulta_id = ?, observacoes = ? WHERE id = ?',
            [paciente_id, profissional_id, consulta_id, observacoes, id]
        );
        
        // Buscar prontuário atualizado
        const [updated] = await pool.execute(`
            SELECT 
                pr.id,
                c.data as data_consulta,
                tc.tipo as tipo_consulta,
                p.nome as paciente_nome,
                p.cpf as paciente_cpf,
                p.email as paciente_email,
                p.telefone as paciente_telefone,
                p.data_nascimento as paciente_nascimento,
                prof.nome as profissional_nome,
                em.especialidade as especialidade,
                car.cargo as profissional_tipo,
                prof.registro_profissional,
                pr.observacoes
            FROM prontuarios pr
            INNER JOIN consultas c on pr.consulta_id = c.id
            INNER JOIN pacientes p ON pr.paciente_id = p.id
            INNER JOIN profissionais prof ON pr.profissional_id = prof.id 
            INNER JOIN tipos_consulta tc ON tc.id = c.tipo
            INNER JOIN especialidades_medicas em ON em.id = prof.especialidade
            INNER JOIN cargos car ON car.id = prof.cargo
            WHERE pr.id = ?
        `, [id]);
        
        res.json({
            success: true,
            message: 'Prontuário atualizado com sucesso',
            data: updated[0]
        });
        
    } catch (error) {
        console.error('Erro ao atualizar prontuário:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// DELETE /api/prontuarios/:id - Deletar prontuário
// Apenas Admin pode deletar prontuários
router.delete('/:id', authorize([USER_TYPE_ADMIN]), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar se prontuário existe
        const [existing] = await pool.execute(`
            SELECT 
                pr.id,
                c.data as data_consulta,
                p.nome as paciente_nome,
                prof.nome as profissional_nome
            FROM prontuarios pr
            INNER JOIN consultas c on pr.consulta_id = c.id
            INNER JOIN pacientes p ON pr.paciente_id = p.id
            INNER JOIN profissionais prof ON pr.profissional_id = prof.id
            WHERE pr.id = ?
        `, [id]);
        
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Prontuário não encontrado'
            });
        }
        
        // Deletar prontuário
        await pool.execute('DELETE FROM prontuarios WHERE id = ?', [id]);
        
        res.json({
            success: true,
            message: 'Prontuário deletado com sucesso'
        });
        
    } catch (error) {
        console.error('Erro ao deletar prontuário:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// GET /api/prontuarios/paciente/:paciente_id - Buscar prontuários por paciente
// Admin, Médico, Enfermeiro podem ver prontuários de qualquer paciente. Paciente pode ver apenas os seus.
router.get('/paciente/:paciente_id', authorize([USER_TYPE_ADMIN, USER_TYPE_MEDICO, USER_TYPE_ENFERMEIRO, USER_TYPE_PACIENTE]), async (req, res) => {
    try {
        const { paciente_id } = req.params;
        const userId = req.user.id;
        const userType = req.user.tipo;

        // Se o usuário for um paciente, ele só pode ver os próprios prontuários
        if (userType === USER_TYPE_PACIENTE && parseInt(paciente_id) !== parseInt(userId)) {
            return res.status(403).json({ success: false, message: 'Acesso negado. Você só pode ver seus próprios prontuários.' });
        }
        
        const [rows] = await pool.execute(`
            SELECT 
                pr.id,
                pr.observacoes,
                prof.nome as profissional_nome,
                em.especialidade as especialidade,
                car.cargo as profissional_tipo,
                c.data as consulta_data,
                tc.tipo as tipo_consulta
            FROM prontuarios pr
            LEFT JOIN profissionais prof ON pr.profissional_id = prof.id
            LEFT JOIN consultas c ON pr.consulta_id = c.id
            LEFT JOIN tipos_consulta tc ON tc.id = c.tipo
            LEFT JOIN especialidades_medicas em ON em.id = prof.especialidade
            LEFT JOIN cargos car ON car.id = prof.cargo
            WHERE pr.paciente_id = ?
            ORDER BY c.data DESC
        `, [paciente_id]);
        
        res.json({
            success: true,
            data: rows,
            total: rows.length,
            paciente_id: paciente_id
        });
        
    } catch (error) {
        console.error('Erro ao buscar prontuários do paciente:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// GET /api/prontuarios/profissional/:profissional_id - Buscar prontuários por profissional
// Admin, Médico, Enfermeiro podem ver prontuários de qualquer profissional. Profissional pode ver apenas os seus.
router.get('/profissional/:profissional_id', authorize([USER_TYPE_ADMIN, USER_TYPE_MEDICO, USER_TYPE_ENFERMEIRO]), async (req, res) => {
    try {
        const { profissional_id } = req.params;
        const userId = req.user.id;
        const userType = req.user.tipo;

        // Se não for Admin, o profissional_id na URL deve ser o ID do usuário logado
        if (userType !== USER_TYPE_ADMIN && parseInt(profissional_id) !== parseInt(userId)) {
            return res.status(403).json({ success: false, message: 'Acesso negado. Você só pode ver seus próprios prontuários.' });
        }
        
        const [rows] = await pool.execute(`
            SELECT 
                pr.id,
                pr.observacoes,
                p.nome as paciente_nome,
                p.cpf as paciente_cpf,
                p.telefone as paciente_telefone,
                c.data as consulta_data,
                tc.tipo as tipo_consulta
            FROM prontuarios pr
            LEFT JOIN pacientes p ON pr.paciente_id = p.id
            LEFT JOIN consultas c ON pr.consulta_id = c.id
            LEFT JOIN tipos_consulta tc ON tc.id = c.tipo
            WHERE pr.profissional_id = ?
            ORDER BY c.data DESC
        `, [profissional_id]);
        
        res.json({
            success: true,
            data: rows,
            total: rows.length,
            profissional_id: profissional_id
        });
        
    } catch (error) {
        console.error('Erro ao buscar prontuários do profissional:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// GET /api/prontuarios/consulta/:consulta_id - Buscar prontuário por consulta
// Admin, Médico, Enfermeiro podem ver prontuários por consulta.
router.get('/consulta/:consulta_id', authorize([USER_TYPE_ADMIN, USER_TYPE_MEDICO, USER_TYPE_ENFERMEIRO]), async (req, res) => {
    try {
        const { consulta_id } = req.params;
        
        const [rows] = await pool.execute(`
            SELECT 
                pr.id,
                pr.paciente_id,
                pr.profissional_id,
                pr.consulta_id,
                pr.observacoes,
                p.nome as paciente_nome,
                p.cpf as paciente_cpf,
                prof.nome as profissional_nome,
                em.especialidade as especialidade,
                c.data as consulta_data,
                tc.tipo as consulta_tipo
            FROM prontuarios pr
            LEFT JOIN pacientes p ON pr.paciente_id = p.id
            LEFT JOIN profissionais prof ON pr.profissional_id = prof.id
            LEFT JOIN consultas c ON pr.consulta_id = c.id
            LEFT JOIN tipos_consulta tc ON tc.id = c.tipo
            LEFT JOIN especialidades_medicas em ON em.id = prof.especialidade
            WHERE pr.consulta_id = ?
        `, [consulta_id]);
        
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Prontuário não encontrado para esta consulta'
            });
        }
        
        res.json({
            success: true,
            data: rows[0],
            consulta_id: consulta_id
        });
        
    } catch (error) {
        console.error('Erro ao buscar prontuário da consulta:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// GET /api/prontuarios/hoje - Buscar prontuários criados hoje
// Admin, Médico, Enfermeiro podem ver prontuários criados hoje
router.get('/hoje', authorize([USER_TYPE_ADMIN, USER_TYPE_MEDICO, USER_TYPE_ENFERMEIRO]), async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                pr.id,
                pr.observacoes,
                p.nome as paciente_nome,
                p.cpf as paciente_cpf,
                prof.nome as profissional_nome,
                em.especialidade as especialidade,
                c.data as consulta_data,
                tc.tipo as consulta_tipo
            FROM prontuarios pr
            LEFT JOIN pacientes p ON pr.paciente_id = p.id
            LEFT JOIN profissionais prof ON pr.profissional_id = prof.id
            LEFT JOIN consultas c ON pr.consulta_id = c.id
            LEFT JOIN tipos_consulta tc ON tc.id = c.tipo
            LEFT JOIN especialidades_medicas em ON em.id = prof.especialidade
            WHERE DATE(pr.data_criacao) = CURDATE()
            ORDER BY c.data DESC
        `);
        
        res.json({
            success: true,
            data: rows,
            total: rows.length,
            data_consulta: new Date().toISOString().split('T')[0]
        });
        
    } catch (error) {
        console.error('Erro ao buscar prontuários de hoje:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

module.exports = router;