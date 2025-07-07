module.exports = function (allowedTypes) {
    return (req, res, next) => {
        // req.user é definido por authMiddleware
        if (!req.user || !req.user.tipo) {
            return res.status(403).json({ message: 'Acesso negado. Tipo de usuário não definido no token.' });
        }

        // Verifica se o tipo de usuário autenticado está entre os tipos permitidos
        if (!allowedTypes.includes(req.user.tipo)) {
            return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para esta ação.' });
        }
        next();
    };
};