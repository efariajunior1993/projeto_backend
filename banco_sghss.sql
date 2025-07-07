-- --------------------------------------------------------
-- Servidor:                     127.0.0.1
-- Versão do servidor:           11.8.2-MariaDB - mariadb.org binary distribution
-- OS do Servidor:               Win64
-- HeidiSQL Versão:              12.10.0.7000
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Copiando estrutura do banco de dados para sghss
CREATE DATABASE IF NOT EXISTS `sghss` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;
USE `sghss`;

-- Copiando estrutura para tabela sghss.cargos
CREATE TABLE IF NOT EXISTS `cargos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cargo` varchar(50) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Copiando dados para a tabela sghss.cargos: ~4 rows (aproximadamente)
INSERT INTO `cargos` (`id`, `cargo`) VALUES
	(1, 'Médico'),
	(2, 'Enfermeiro'),
	(3, 'Técnico'),
	(4, 'Administrador');

-- Copiando estrutura para tabela sghss.consultas
CREATE TABLE IF NOT EXISTS `consultas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `paciente_id` int(11) NOT NULL,
  `profissional_id` int(11) NOT NULL,
  `data` datetime NOT NULL,
  `tipo` int(11) NOT NULL,
  `descricao` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `paciente_id` (`paciente_id`),
  KEY `profissional_id` (`profissional_id`),
  KEY `FK_consultas_tipos_consulta` (`tipo`),
  CONSTRAINT `FK_consultas_tipos_consulta` FOREIGN KEY (`tipo`) REFERENCES `tipos_consulta` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Copiando dados para a tabela sghss.consultas: ~0 rows (aproximadamente)
INSERT INTO `consultas` (`id`, `paciente_id`, `profissional_id`, `data`, `tipo`, `descricao`) VALUES
	(1, 1, 1, '2025-08-15 12:00:00', 1, 'Primeira consulta');

-- Copiando estrutura para tabela sghss.especialidades_medicas
CREATE TABLE IF NOT EXISTS `especialidades_medicas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `especialidade` varchar(50) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Copiando dados para a tabela sghss.especialidades_medicas: ~5 rows (aproximadamente)
INSERT INTO `especialidades_medicas` (`id`, `especialidade`) VALUES
	(1, 'Cardiologista'),
	(2, 'Urologista'),
	(3, 'Pediatra'),
	(4, 'Endocrinologista'),
	(6, 'Não aplicável');

-- Copiando estrutura para tabela sghss.pacientes
CREATE TABLE IF NOT EXISTS `pacientes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) NOT NULL,
  `data_nascimento` date NOT NULL,
  `cpf` varchar(14) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `telefone` varchar(20) DEFAULT NULL,
  `id_usuario` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cpf` (`cpf`),
  KEY `FK_pacientes_usuarios` (`id_usuario`),
  CONSTRAINT `FK_pacientes_usuarios` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Copiando dados para a tabela sghss.pacientes: ~1 rows (aproximadamente)
INSERT INTO `pacientes` (`id`, `nome`, `data_nascimento`, `cpf`, `email`, `telefone`, `id_usuario`) VALUES
	(1, 'Naruto Uzumaki', '1990-10-10', '111.111.111-11', 'naruto@email.com', '(11)90000-1111', 13),
	(2, 'Sasuke Uchiha', '1989-07-15', '564.321.021-89', 'sasuke@email', '(11)98396-6669', NULL);

-- Copiando estrutura para tabela sghss.profissionais
CREATE TABLE IF NOT EXISTS `profissionais` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) NOT NULL,
  `cpf` varchar(14) NOT NULL,
  `especialidade` int(11) DEFAULT NULL,
  `cargo` int(11) DEFAULT NULL,
  `registro_profissional` varchar(50) DEFAULT NULL,
  `id_usuario` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cpf` (`cpf`),
  KEY `FK_profissionais_especialidades_medicas` (`especialidade`),
  KEY `FK_profissionais_cargos` (`cargo`),
  KEY `FK_profissionais_usuarios` (`id_usuario`),
  CONSTRAINT `FK_profissionais_cargos` FOREIGN KEY (`cargo`) REFERENCES `cargos` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_profissionais_especialidades_medicas` FOREIGN KEY (`especialidade`) REFERENCES `especialidades_medicas` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `FK_profissionais_usuarios` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Copiando dados para a tabela sghss.profissionais: ~1 rows (aproximadamente)
INSERT INTO `profissionais` (`id`, `nome`, `cpf`, `especialidade`, `cargo`, `registro_profissional`, `id_usuario`) VALUES
	(1, 'Shikaku Nara', '222.222.222-22', 1, 1, 'CRM12345', 10),
	(2, 'Hatake Kakashi', '989.878.767-65', 2, 2, 'CRM65465', NULL);

-- Copiando estrutura para tabela sghss.prontuarios
CREATE TABLE IF NOT EXISTS `prontuarios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `paciente_id` int(11) DEFAULT NULL,
  `profissional_id` int(11) DEFAULT NULL,
  `consulta_id` int(11) DEFAULT NULL,
  `observacoes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `paciente_id` (`paciente_id`),
  KEY `profissional_id` (`profissional_id`),
  KEY `consulta_id` (`consulta_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Copiando dados para a tabela sghss.prontuarios: ~0 rows (aproximadamente)
INSERT INTO `prontuarios` (`id`, `paciente_id`, `profissional_id`, `consulta_id`, `observacoes`) VALUES
	(2, 1, 1, 1, 'Retornar após realização dos exames pedidos');

-- Copiando estrutura para tabela sghss.tipos_consulta
CREATE TABLE IF NOT EXISTS `tipos_consulta` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Copiando dados para a tabela sghss.tipos_consulta: ~2 rows (aproximadamente)
INSERT INTO `tipos_consulta` (`id`, `tipo`) VALUES
	(1, 'Presencial'),
	(2, 'Telemedicina');

-- Copiando estrutura para tabela sghss.tipo_usuario
CREATE TABLE IF NOT EXISTS `tipo_usuario` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tipo_usuario` varchar(50) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Copiando dados para a tabela sghss.tipo_usuario: ~4 rows (aproximadamente)
INSERT INTO `tipo_usuario` (`id`, `tipo_usuario`) VALUES
	(1, 'Admin'),
	(2, 'Médico'),
	(3, 'Enfermeiro/Técnico'),
	(4, 'Paciente');

-- Copiando estrutura para tabela sghss.usuarios
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(50) NOT NULL DEFAULT '',
  `senha` varchar(255) NOT NULL DEFAULT '0',
  `tipo` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `FK_usuarios_tipo_usuario` (`tipo`),
  CONSTRAINT `FK_usuarios_tipo_usuario` FOREIGN KEY (`tipo`) REFERENCES `tipo_usuario` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Copiando dados para a tabela sghss.usuarios: ~5 rows (aproximadamente)
INSERT INTO `usuarios` (`id`, `email`, `senha`, `tipo`) VALUES
	(10, 'shikaku@email.com', '$2b$10$eCZJG8b15o.xodxFHqZH4ewuacyP.7RxZChGJdQQXf0jigZVLoF3G', 2),
	(11, 'josecarlos@email.com', '$2b$10$M2S8nE0hPgaVWSYmStvAFu39IC0GW37AvvHBlH6DgyCp2DexZ3jiy', 2),
	(12, 'marcelopereira@email.com', '$2b$10$5q5fdOjCndYB0uoKwSGp9eEDbQ7fwZK2bxoQjnwCK7neBoCJBaSAK', 1),
	(13, 'naruto@email.com', '$2b$10$GCYFsOT4AB31EDnaZZ3uBOV.IE3hgTxHF1tgs3E.7yMllXH9R90dC', 4),
	(14, 'asdrubal@email.com', '$2b$10$VcvbRgOglaRdKKCweuLqjeMtQsC6PSEXpBRnKWqrSPVefq0MfxEee', 4);

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
