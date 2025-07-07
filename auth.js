const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('./database');

// Certifique-se de ter uma chave secreta JWT no seu .env
// Ex: JWT_SECRET= "chave_secreta"
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    console.error('Erro: JWT_SECRET não definida no arquivo .env');
    process.exit(1);
}

// Rota de Registro (Signup) - Agora para a tabela 'usuarios'
router.post('/signup', async (req, res) => {
    try {
        const { email, senha, tipo } = req.body;

        // Validações básicas
        if (!email || !senha || !tipo) {
            return res.status(400).json({
                success: false,
                message: 'Email, senha e tipo de usuário são obrigatórios'
            });
        }

        // Hash da senha
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(senha, salt);

        // Verificar se o email já existe na tabela 'usuarios'
        const [existing] = await pool.execute(
            'SELECT id FROM usuarios WHERE email = ?',
            [email]
        );
        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Email já cadastrado'
            });
        }

        // Inserir novo usuário na tabela 'usuarios'
        const [result] = await pool.execute(
            'INSERT INTO usuarios (email, senha, tipo) VALUES (?, ?, ?)',
            [email, senhaHash, tipo]
        );

        const [newUser] = await pool.execute(
            'SELECT id, email, tipo FROM usuarios WHERE id = ?',
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            message: 'Usuário registrado com sucesso',
            data: newUser[0]
        });

    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// Rota de Login - Agora para a tabela 'usuarios'
router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({
                success: false,
                message: 'Email e senha são obrigatórios'
            });
        }

        // Buscar usuário por email na tabela 'usuarios'
        const [rows] = await pool.execute(
            'SELECT id, email, senha, tipo FROM usuarios WHERE email = ?',
            [email]
        );

        if (rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }

        const usuario = rows[0];

        // Comparar senha
        const isMatch = await bcrypt.compare(senha, usuario.senha);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }

        // Gerar JWT
        const payload = {
            user: {
                id: usuario.id,
                email: usuario.email,
                tipo: usuario.tipo // Inclui o tipo para validação de permissões
            }
        };

        jwt.sign(
            payload,
            jwtSecret,
            { expiresIn: '1h' }, // Token expira em 1 hora
            (err, token) => {
                if (err) throw err;
                res.json({
                    success: true,
                    message: 'Login bem-sucedido',
                    token: token,
                    user: {
                        id: usuario.id,
                        email: usuario.email,
                        tipo: usuario.tipo
                    }
                });
            }
        );

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

module.exports = router;