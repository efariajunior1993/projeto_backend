const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const authorize = require('../middleware/authorize'); // Importe o middleware de autorização

// Definir os tipos de usuário (IDs da tabela tipo_usuario)
const USER_TYPE_ADMIN = 1;
const USER_TYPE_MEDICO = 2;
const USER_TYPE_ENFERMEIRO = 3;
const USER_TYPE_PACIENTE = 4;

// GET /api/pacientes - Listar todos os pacientes
// Apenas Admin, Médico e Enfermeiro podem ver todos os pacientes
router.get('/', authorize([USER_TYPE_ADMIN, USER_TYPE_MEDICO, USER_TYPE_ENFERMEIRO]), async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM pacientes ORDER BY nome');
        res.json({
            success: true,
            data: rows,
            total: rows.length
        });
    } catch (error) {
        console.error('Erro ao buscar pacientes:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// GET /api/pacientes/:id - Buscar paciente por ID
// Admin, Médico, Enfermeiro podem ver qualquer paciente. Paciente pode ver apenas o seu próprio registro.
router.get('/:id', authorize([USER_TYPE_ADMIN, USER_TYPE_MEDICO, USER_TYPE_ENFERMEIRO, USER_TYPE_PACIENTE]), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id; // ID do usuário autenticado
        const userType = req.user.tipo; // Tipo do usuário autenticado

        let query = 'SELECT * FROM pacientes WHERE id = ?';
        let queryParams = [id];

        // Se o usuário for um paciente, ele só pode acessar o próprio registro
        if (userType === USER_TYPE_PACIENTE) {
            // Verificar se o paciente_id na URL corresponde ao ID do usuário autenticado
            const [pacienteUsuario] = await pool.execute('SELECT p.id FROM usuarios u INNER JOIN pacientes p ON u.id = p.id_usuario WHERE p.id_usuario = ?', [userId]);
            if (pacienteUsuario.length === 0) {
                return res.status(403).json({ success: false, message: 'Acesso negado. Usuário paciente não associado.' });
            }
            // Para um paciente, o ID do paciente é o mesmo ID do usuário
            if (parseInt(id) !== parseInt(pacienteUsuario[0].id)) {
                return res.status(403).json({ success: false, message: 'Acesso negado. Você só pode acessar seu próprio registro.' });
            }
        }

        const [rows] = await pool.execute(query, queryParams);
        
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Paciente não encontrado'
            });
        }
        
        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Erro ao buscar paciente:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// POST /api/pacientes - Criar novo paciente
// Apenas Admin e pacientes podem criar pacientes
router.post('/', authorize([USER_TYPE_ADMIN, USER_TYPE_PACIENTE]), async (req, res) => {
    try {
        const { nome, data_nascimento, cpf, email, telefone } = req.body;
        // Validações básicas
        if (!nome || !data_nascimento || !cpf) {
            return res.status(400).json({
                success: false,
                message: 'Nome, data de nascimento e CPF são obrigatórios'
            });
        }
        
        // Verificar se CPF já existe
        const [existing] = await pool.execute(
            'SELECT id FROM pacientes WHERE cpf = ?',
            [cpf]
        );
        
        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'CPF já cadastrado'
            });
        }
        
        // Inserir novo paciente
        const [result] = await pool.execute(
            'INSERT INTO pacientes (nome, data_nascimento, cpf, email, telefone) VALUES (?, ?, ?, ?, ?)',
            [nome, data_nascimento, cpf, email, telefone]
        );
        
        // Buscar o paciente criado
        const [newPatient] = await pool.execute(
            'SELECT * FROM pacientes WHERE id = ?',
            [result.insertId]
        );
        
        res.status(201).json({
            success: true,
            message: 'Paciente criado com sucesso',
            data: newPatient[0]
        });
        
    } catch (error) {
        console.error('Erro ao criar paciente:', error);
        
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'CPF já cadastrado'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// PUT /api/pacientes/:id - Atualizar paciente
// Apenas Admin pode atualizar pacientes
router.put('/:id', authorize([USER_TYPE_ADMIN]), async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, data_nascimento, cpf, email, telefone } = req.body;
        
        // Verificar se paciente existe
        const [existing] = await pool.execute(
            'SELECT id FROM pacientes WHERE id = ?',
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Paciente não encontrado'
            });
        }
        
        // Verificar se CPF já existe em outro paciente
        const [cpfCheck] = await pool.execute(
            'SELECT id FROM pacientes WHERE cpf = ? AND id != ?',
            [cpf, id]
        );
        
        if (cpfCheck.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'CPF já cadastrado para outro paciente'
            });
        }
        
        // Atualizar paciente
        await pool.execute(
            'UPDATE pacientes SET nome = ?, data_nascimento = ?, cpf = ?, email = ?, telefone = ? WHERE id = ?',
            [nome, data_nascimento, cpf, email, telefone, id]
        );
        
        // Buscar paciente atualizado
        const [updated] = await pool.execute(
            'SELECT * FROM pacientes WHERE id = ?',
            [id]
        );
        
        res.json({
            success: true,
            message: 'Paciente atualizado com sucesso',
            data: updated[0]
        });
        
    } catch (error) {
        console.error('Erro ao atualizar paciente:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// DELETE /api/pacientes/:id - Deletar paciente
// Apenas Admin pode deletar pacientes
router.delete('/:id', authorize([USER_TYPE_ADMIN]), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar se paciente existe
        const [existing] = await pool.execute(
            'SELECT id, nome FROM pacientes WHERE id = ?',
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Paciente não encontrado'
            });
        }
        
        // Verificar se paciente tem consultas/prontuários (opcional)
        const [hasRecords] = await pool.execute(
            'SELECT COUNT(*) as total FROM consultas WHERE paciente_id = ?',
            [id]
        );
        
        if (hasRecords[0].total > 0) {
            return res.status(409).json({
                success: false,
                message: 'Não é possível deletar paciente com consultas cadastradas'
            });
        }
        
        // Deletar paciente
        await pool.execute('DELETE FROM pacientes WHERE id = ?', [id]);
        
        res.json({
            success: true,
            message: `Paciente ${existing[0].nome} deletado com sucesso`
        });
        
    } catch (error) {
        console.error('Erro ao deletar paciente:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// GET /api/pacientes/search/:termo - Buscar pacientes por nome ou CPF
// Apenas Admin, Médico e Enfermeiro podem buscar pacientes
router.get('/search/:termo', authorize([USER_TYPE_ADMIN, USER_TYPE_MEDICO, USER_TYPE_ENFERMEIRO]), async (req, res) => {
    try {
        const { termo } = req.params;
        
        const [rows] = await pool.execute(
            'SELECT * FROM pacientes WHERE nome LIKE ? OR cpf LIKE ? ORDER BY nome',
            [`%${termo}%`, `%${termo}%`]
        );
        
        res.json({
            success: true,
            data: rows,
            total: rows.length,
            termo: termo
        });
        
    } catch (error) {
        console.error('Erro na busca:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

module.exports = router;