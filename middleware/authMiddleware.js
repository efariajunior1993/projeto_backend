const jwt = require('jsonwebtoken');

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    console.error('Erro: JWT_SECRET não definida no arquivo .env');
    process.exit(1);
}

module.exports = function (req, res, next) {
    // Obter o token do cabeçalho
    const token = req.header('x-auth-token');

    // Verificar se não há token
    if (!token) {
        return res.status(401).json({ message: 'Nenhum token, autorização negada' });
    }

    // Verificar o token
    try {
        const decoded = jwt.verify(token, jwtSecret);
        req.user = decoded.user;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token não é válido' });
    }
};
