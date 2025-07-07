const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const authorize = require('../middleware/authorize'); // Importe o middleware de autorização

// Definir os tipos de usuário (IDs da tabela tipo_usuario)
const USER_TYPE_ADMIN = 1;
const USER_TYPE_MEDICO = 2;
const USER_TYPE_ENFERMEIRO = 3;
const USER_TYPE_PACIENTE = 4;

// GET /api/profissionais - Listar todos os profissionais
// Apenas Admin, Médico e Enfermeiro podem ver todos os profissionais
router.get('/', authorize([USER_TYPE_ADMIN, USER_TYPE_MEDICO, USER_TYPE_ENFERMEIRO]), async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                prof.id,
                prof.nome,
                prof.cpf,
                car.cargo as cargo,
                em.especialidade as especialidade,
                prof.registro_profissional
            FROM profissionais prof
            LEFT JOIN cargos car ON prof.cargo = car.id
            LEFT JOIN especialidades_medicas em ON prof.especialidade = em.id
            ORDER BY prof.id DESC
        `);
        res.json({
            success: true,
            data: rows,
            total: rows.length
        });
    } catch (error) {
        console.error('Erro ao buscar profissionais:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// GET /api/profissionais/:id - Buscar profissional por ID
// Admin, Médico, Enfermeiro podem ver qualquer profissional.
router.get('/:id', authorize([USER_TYPE_ADMIN, USER_TYPE_MEDICO, USER_TYPE_ENFERMEIRO]), async (req, res) => {
    try {
        const { id } = req.params;
        
        const [rows] = await pool.execute(
            'SELECT id, nome, cpf, especialidade, cargo, registro_profissional FROM profissionais WHERE id = ?', // Não retornar a senha
            [id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Profissional não encontrado'
            });
        }
        
        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Erro ao buscar profissional:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// POST /api/profissionais - Criar novo profissional
router.post('/', authorize([USER_TYPE_ADMIN, USER_TYPE_MEDICO, USER_TYPE_ENFERMEIRO]), async (req, res) => {
    try {
        const { nome, cpf, especialidade, cargo, registro_profissional} = req.body;
        
        // Validações básicas
        if (!nome || !cpf || !cargo) {
            return res.status(400).json({
                success: false,
                message: 'Nome, CPF e tipo são obrigatórios'
            });
        }
        
        // Validar tipo (deve ser um dos ENUMs)
        const tiposValidos = [1,2,3,4];
        if (!tiposValidos.includes(cargo)) {
            return res.status(400).json({
                success: false,
                message: 'Tipo deve ser: 1-Médico, 2-Enfermeiro, 3-Técnico, 4-Administrador'
            });
        }
        
        // Verificar se CPF já existe
        const [existing] = await pool.execute(
            'SELECT id FROM profissionais WHERE cpf = ?',
            [cpf]
        );
        
        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'CPF já cadastrado'
            });
        }
        
        // Verificar se registro profissional já existe (se informado)
        if (registro_profissional) {
            const [regExists] = await pool.execute(
                'SELECT id FROM profissionais WHERE registro_profissional = ?',
                [registro_profissional]
            );
            
            if (regExists.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Registro profissional já cadastrado'
                });
            }
        }
        
        // Inserir novo profissional
       const [result] = await pool.execute(
        'INSERT INTO profissionais (nome, cpf, especialidade, cargo, registro_profissional) VALUES (?, ?, ?, ?, ?)',
             [nome, cpf, especialidade, cargo, registro_profissional]);

        
        // Buscar o profissional criado
        const [newProfessional] = await pool.execute(
            'SELECT * FROM profissionais WHERE id = ?',
            [result.insertId]
        );
        
        res.status(201).json({
            success: true,
            message: 'Profissional criado com sucesso',
            data: newProfessional[0]
        });
        
    } catch (error) {
        console.error('Erro ao criar profissional:', error);
        
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'CPF ou registro profissional já cadastrado'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});



// PUT /api/profissionais/:id - Atualizar profissional
// Apenas Admin pode atualizar profissionais
router.put('/:id', authorize([USER_TYPE_ADMIN]), async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, cpf, especialidade, cargo, registro_profissional, senha } = req.body; // Pode receber a senha para atualização
        
        // Validar tipo (deve ser um dos ENUMs)
        const tiposValidos = [1,2,3,4];
        if (cargo && !tiposValidos.includes(cargo)) {
            return res.status(400).json({
                success: false,
                message: 'Tipo deve ser: 1-Médico, 2-Enfermeiro, 3-Técnico, 4-Administrador'
            });
        }
        
        // Verificar se profissional existe
        const [existing] = await pool.execute(
            'SELECT id FROM profissionais WHERE id = ?',
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Profissional não encontrado'
            });
        }
        
        // Verificar se CPF já existe em outro profissional
        if (cpf) {
            const [cpfCheck] = await pool.execute(
                'SELECT id FROM profissionais WHERE cpf = ? AND id != ?',
                [cpf, id]
            );
            
            if (cpfCheck.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'CPF já cadastrado para outro profissional'
                });
            }
        }
        
        // Verificar registro profissional
        if (registro_profissional) {
            const [regCheck] = await pool.execute(
                'SELECT id FROM profissionais WHERE registro_profissional = ? AND id != ?',
                [registro_profissional, id]
            );
            
            if (regCheck.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Registro profissional já cadastrado'
                });
            }
        }
        
        // Construir a query de atualização dinamicamente
        let updateFields = [];
        let queryParams = [];

        if (nome !== undefined) { updateFields.push('nome = ?'); queryParams.push(nome); }
        if (cpf !== undefined) { updateFields.push('cpf = ?'); queryParams.push(cpf); }
        if (especialidade !== undefined) { updateFields.push('especialidade = ?'); queryParams.push(especialidade); }
        if (cargo !== undefined) { updateFields.push('cargo = ?'); queryParams.push(cargo); }
        if (registro_profissional !== undefined) { updateFields.push('registro_profissional = ?'); queryParams.push(registro_profissional); }
        
        // A senha do profissional é atualizada na tabela 'usuarios' via rota de usuário, não aqui.
        // Se a senha for fornecida aqui, significa que a intenção é atualizar a senha do usuário associado.
        // No entanto, para manter a separação de responsabilidades, a atualização de senha deve ser feita
        // através de uma rota específica de atualização de usuário/senha, não na rota de atualização de perfil profissional.
        // Portanto, a lógica de hash de senha foi removida daqui.

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Nenhum dado para atualizar fornecido'
            });
        }

        const updateQuery = `UPDATE profissionais SET ${updateFields.join(', ')} WHERE id = ?`;
        queryParams.push(id);
        
        await pool.execute(updateQuery, queryParams);
        
        // Buscar profissional atualizado (sem a senha)
        const [updated] = await pool.execute(
            'SELECT id, nome, cpf, especialidade, cargo, registro_profissional FROM profissionais WHERE id = ?',
            [id]
        );
        
        res.json({
            success: true,
            message: 'Profissional atualizado com sucesso',
            data: updated[0]
        });
        
    } catch (error) {
        console.error('Erro ao atualizar profissional:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// DELETE /api/profissionais/:id - Deletar profissional
// Apenas Admin pode deletar profissionais
router.delete('/:id', authorize([USER_TYPE_ADMIN]), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar se profissional existe
        const [existing] = await pool.execute(
            'SELECT id, nome FROM profissionais WHERE id = ?',
            [id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Profissional não encontrado'
            });
        }
        
        // Verificar se profissional tem consultas cadastradas
        const [hasConsultas] = await pool.execute(
            'SELECT COUNT(*) as total FROM consultas WHERE profissional_id = ?',
            [id]
        );
        
        if (hasConsultas[0].total > 0) {
            return res.status(409).json({
                success: false,
                message: 'Não é possível deletar profissional com consultas cadastradas'
            });
        }
        
        // Verificar se profissional tem prontuários
        const [hasProntuarios] = await pool.execute(
            'SELECT COUNT(*) as total FROM prontuarios WHERE profissional_id = ?',
            [id]
        );
        
        if (hasProntuarios[0].total > 0) {
            return res.status(409).json({
                success: false,
                message: 'Não é possível deletar profissional com prontuários cadastrados'
            });
        }
        
        // Deletar profissional
        await pool.execute('DELETE FROM profissionais WHERE id = ?', [id]);
        
        res.json({
            success: true,
            message: `Profissional ${existing[0].nome} deletado com sucesso`
        });
        
    } catch (error) {
        console.error('Erro ao deletar profissional:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// GET /api/profissionais/search/:termo - Buscar profissionais por nome ou especialidade
// Apenas Admin, Médico e Enfermeiro podem buscar profissionais
router.get('/search/:termo', authorize([USER_TYPE_ADMIN, USER_TYPE_MEDICO, USER_TYPE_ENFERMEIRO]), async (req, res) => {
    try {
        const { termo } = req.params;
        
        const [rows] = await pool.execute(
            'SELECT id, nome, cpf, especialidade, cargo, registro_profissional FROM profissionais WHERE nome LIKE ? OR especialidade LIKE ? OR registro_profissional LIKE ? ORDER BY nome', // Não retornar a senha
            [`%${termo}%`, `%${termo}%`, `%${termo}%`]
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

// GET /api/profissionais/tipos/estatisticas - Estatísticas por tipo
// Apenas Admin pode ver estatísticas
router.get('/tipos/estatisticas', authorize([USER_TYPE_ADMIN]), async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                car.cargo as tipo,
                COUNT(*) as quantidade,
                GROUP_CONCAT(DISTINCT em.especialidade SEPARATOR ', ') as especialidades
            FROM profissionais 
            LEFT JOIN cargos car ON profissionais.cargo = car.id
            LEFT JOIN especialidades_medicas em ON profissionais.especialidade = em.id
            GROUP BY car.cargo 
            ORDER BY quantidade DESC
        `);
        
        const [total] = await pool.execute('SELECT COUNT(*) as total FROM profissionais');
        
        res.json({
            success: true,
            data: rows,
            total_profissionais: total[0].total
        });
        
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

module.exports = router;