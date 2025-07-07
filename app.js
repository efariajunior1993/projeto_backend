const express = require('express');
const { pool, testarConexao } = require('./database');
const routes = require('./routes'); // Suas rotas existentes
const authRoutes = require('./auth');

const app = express();
app.use(express.json());

// Adicionar as rotas de autenticação
app.use('/api/auth', authRoutes);

// Todas as rotas abaixo de '/api' que precisam de autenticação
// devem ser protegidas com o middleware authMiddleware.
// Isso será feito no arquivo index.js para as rotas principais.
app.use('/api', routes);

// Rota de status da conexão
app.get('/status', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        connection.release();
        
        res.json({
            status: 'Conectado',
            database: process.env.DB_NAME,
            host: process.env.DB_HOST,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'Erro',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Rota básica
app.get('/', (req, res) => {
    res.json({
        message: 'Sistema de Gestão Hospitalar - SGHSS',
        version: '1.0.0',
        database: process.env.DB_NAME
    });
});

// Rota para testar conexão
app.get('/test-connection', async (req, res) => {
    const isConnected = await testarConexao();
    
    if (isConnected) {
        res.json({
            status: 'success',
            message: 'Conexão testada com sucesso'
        });
    } else {
        res.status(500).json({
            status: 'error',
            message: 'Falha na conexão com o banco'
        });
    }
});

// Configuração da porta
const PORT = process.env.PORT || 3000;

// Iniciar servidor
app.listen(PORT, async () => {
    console.log(`🚀 Servidor rodando na porta porta ${PORT}`);
    console.log(`🗄️  Usando banco: ${process.env.DB_NAME}`);
    console.log(`🌐 Acesse: http://localhost:${PORT}`);
    
    // Testar conexão na inicialização
    console.log('\n📋 Testando conexão com o banco...');
    await testarConexao();
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (err) => {
    console.error('Erro não tratado:', err);
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('Exceção não capturada:', err);
    process.exit(1);
});