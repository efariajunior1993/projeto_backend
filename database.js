require('dotenv').config();
const mysql = require('mysql2/promise');

// Verificar se variáveis críticas existem
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET']; // Adicione JWT_SECRET

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`Erro: Variável ${envVar} não foi definida no arquivo .env`);
        process.exit(1);
    }
}

// Configuração do pool usando variáveis de ambiente
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'sghss',
    port: parseInt(process.env.DB_PORT) || 3306,
    charset: process.env.DB_CHARSET || 'utf8mb4',
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
};

// Criar o pool
const pool = mysql.createPool(dbConfig);

// Eventos do pool
pool.on('connection', (connection) => {
    console.log('Nova conexão estabelecida como id ' + connection.threadId);
});

pool.on('error', (err) => {
    console.error('Erro no pool de conexões:', err);
});

// Função para testar conexão
async function testarConexao() {
    try {
        const connection = await pool.getConnection();
        console.log(`✅ Conectado ao banco ${process.env.DB_NAME} com sucesso!`);
        console.log(`📡 Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Erro ao conectar:', error.message);
        return false;
    }
}

module.exports = {
    pool,
    testarConexao
};