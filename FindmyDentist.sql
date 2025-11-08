-- ==========================================================
-- TẠO DATABASE
-- ==========================================================
DROP DATABASE IF EXISTS `FindMyDentist`;
CREATE DATABASE IF NOT EXISTS `FindMyDentist` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `FindMyDentist`;

-- ==========================================================
-- Vô hiệu hóa kiểm tra khóa ngoại để tạo bảng
-- ==========================================================
SET FOREIGN_KEY_CHECKS=0;


-- ==========================================================
-- BẢNG CHÍNH (THỰC THỂ)
-- ==========================================================

-- ----------------------------
-- 1. Bảng Users (Supertype)
-- ----------------------------
DROP TABLE IF EXISTS `Users`;
CREATE TABLE `Users` (
  `user_id` VARCHAR(50) PRIMARY KEY, -- Đã đổi
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `phone_number` VARCHAR(20) UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `first_name` VARCHAR(100),
  `middle_name` VARCHAR(100),
  `last_name` VARCHAR(100),
  `gender` ENUM('Male', 'Female', 'Other'),
  `date_of_birth` DATE,
  `address` TEXT,
  `role` ENUM('CUSTOMER', 'DENTIST', 'ADMIN') NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------
-- 2. Bảng Customers (Subtype)
-- ----------------------------
DROP TABLE IF EXISTS `Customers`;
CREATE TABLE `Customers` (
  `user_id` VARCHAR(50) PRIMARY KEY, -- Đã đổi
  `reputation_score` INT DEFAULT 100,
  `cccd_num` VARCHAR(20) UNIQUE,
  `ban_status` BOOLEAN DEFAULT FALSE,
  `report_count` INT DEFAULT 0,
  `is_verified` BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (`user_id`) REFERENCES `Users`(`user_id`) ON DELETE CASCADE
);

-- ----------------------------
-- 3. Bảng Dentists (Subtype)
-- ----------------------------
DROP TABLE IF EXISTS `Dentists`;
CREATE TABLE `Dentists` (
  `user_id` VARCHAR(50) PRIMARY KEY, -- Đã đổi
  `years_of_exp` INT DEFAULT 0,
  `specialization` VARCHAR(255),
  `average_rating` FLOAT DEFAULT 0.0,
  `bio` TEXT,
  `is_verified` BOOLEAN DEFAULT FALSE,
  `social_link` VARCHAR(255),
  `availability_schedule` JSON,
  `license_num` VARCHAR(100) UNIQUE,
  FOREIGN KEY (`user_id`) REFERENCES `Users`(`user_id`) ON DELETE CASCADE
);

-- ----------------------------
-- 4. Bảng Clinics
-- ----------------------------
DROP TABLE IF EXISTS `Clinics`;
CREATE TABLE `Clinics` (
  `clinic_id` VARCHAR(50) PRIMARY KEY, -- Đã đổi
  `name` VARCHAR(255) NOT NULL,
  `address` TEXT NOT NULL,
  `phone_number` VARCHAR(20),
  `email` VARCHAR(255),
  `opening_hours` JSON,
  `description` TEXT,
  `images` JSON,
  `total_reviews` INT DEFAULT 0,
  `average_rating` FLOAT DEFAULT 0.0,
  `is_verified` BOOLEAN DEFAULT FALSE
);

-- ----------------------------
-- 5. Bảng Services
-- ----------------------------
DROP TABLE IF EXISTS `Services`;
CREATE TABLE `Services` (
  `service_id` VARCHAR(50) PRIMARY KEY, -- Đã đổi
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `min_price` DECIMAL(10, 2),
  `max_price` DECIMAL(10, 2),
  `expected_duration_minutes` INT
);

-- ----------------------------
-- 6. Bảng Appointments
-- ----------------------------
DROP TABLE IF EXISTS `Appointments`;
CREATE TABLE `Appointments` (
  `appointment_id` VARCHAR(50) PRIMARY KEY, -- Đã đổi
  `customer_id` VARCHAR(50), -- Đã đổi
  `dentist_id` VARCHAR(50), -- Đã đổi
  `clinic_id` VARCHAR(50), -- Đã đổi
  `appointment_datetime` DATETIME NOT NULL,
  `status` ENUM('Pending', 'Confirmed', 'Cancelled', 'Completed') DEFAULT 'Pending',
  `notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`customer_id`) REFERENCES `Users`(`user_id`) ON DELETE SET NULL,
  FOREIGN KEY (`dentist_id`) REFERENCES `Users`(`user_id`) ON DELETE SET NULL,
  FOREIGN KEY (`clinic_id`) REFERENCES `Clinics`(`clinic_id`) ON DELETE RESTRICT
);

-- ----------------------------
-- 7. Bảng Reviews
-- ----------------------------
DROP TABLE IF EXISTS `Reviews`;
CREATE TABLE `Reviews` (
  `review_id` VARCHAR(50) PRIMARY KEY, -- Đã đổi
  `appointment_id` VARCHAR(50) NOT NULL UNIQUE, -- Đã đổi
  `customer_id` VARCHAR(50), -- Đã đổi
  `dentist_id` VARCHAR(50), -- Đã đổi
  `clinic_id` VARCHAR(50), -- Đã đổi
  `rating` TINYINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  `comment` TEXT,
  `is_verified` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`appointment_id`) REFERENCES `Appointments`(`appointment_id`) ON DELETE CASCADE,
  FOREIGN KEY (`customer_id`) REFERENCES `Users`(`user_id`) ON DELETE SET NULL,
  FOREIGN KEY (`dentist_id`) REFERENCES `Users`(`user_id`) ON DELETE SET NULL,
  FOREIGN KEY (`clinic_id`) REFERENCES `Clinics`(`clinic_id`) ON DELETE SET NULL
);


-- ==========================================================
-- BẢNG TRUNG GIAN (CHO QUAN HỆ N:N)
-- ==========================================================

-- ----------------------------
-- 8. Clinic_Dentists
-- ----------------------------
DROP TABLE IF EXISTS `Clinic_Dentists`;
CREATE TABLE `Clinic_Dentists` (
  `clinic_id` VARCHAR(50), 
  `dentist_id` VARCHAR(50), 
  PRIMARY KEY (`clinic_id`, `dentist_id`),
  FOREIGN KEY (`clinic_id`) REFERENCES `Clinics`(`clinic_id`) ON DELETE CASCADE,
  FOREIGN KEY (`dentist_id`) REFERENCES `Users`(`user_id`) ON DELETE CASCADE
);

-- ----------------------------
-- 9. Clinic_Services
-- ----------------------------
DROP TABLE IF EXISTS `Clinic_Services`;
CREATE TABLE `Clinic_Services` (
  `clinic_id` VARCHAR(50), 
  `service_id` VARCHAR(50), 
  PRIMARY KEY (`clinic_id`, `service_id`),
  FOREIGN KEY (`clinic_id`) REFERENCES `Clinics`(`clinic_id`) ON DELETE CASCADE,
  FOREIGN KEY (`service_id`) REFERENCES `Services`(`service_id`) ON DELETE CASCADE
);

-- ----------------------------
-- 10. Dentist_Services
-- ----------------------------
DROP TABLE IF EXISTS `Dentist_Services`;
CREATE TABLE `Dentist_Services` (
  `dentist_id` VARCHAR(50), -- Đã đổi
  `service_id` VARCHAR(50), -- Đã đổi
  PRIMARY KEY (`dentist_id`, `service_id`),
  FOREIGN KEY (`dentist_id`) REFERENCES `Users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`service_id`) REFERENCES `Services`(`service_id`) ON DELETE CASCADE
);

-- ----------------------------
-- 11. Appointment_Services
-- ----------------------------
DROP TABLE IF EXISTS `Appointment_Services`;
CREATE TABLE `Appointment_Services` (
  `appointment_id` VARCHAR(50), -- Đã đổi
  `service_id` VARCHAR(50), -- Đã đổi
  PRIMARY KEY (`appointment_id`, `service_id`),
  FOREIGN KEY (`appointment_id`) REFERENCES `Appointments`(`appointment_id`) ON DELETE CASCADE,
  FOREIGN KEY (`service_id`) REFERENCES `Services`(`service_id`) ON DELETE CASCADE
);


-- ==========================================================
-- Kích hoạt lại kiểm tra khóa ngoại
-- ==========================================================
SET FOREIGN_KEY_CHECKS=1;


-- ==========================================================
-- DỮ LIỆU MẪU (INSERT DATA)
-- ==========================================================

-- 1. Users

-- 2. Customers (chi tiết)
INSERT INTO `Customers` (`user_id`, `reputation_score`, `cccd_num`, `is_verified`) VALUES
('cust1', 100, '012345678901', 1),
('cust2', 90, '098765432101', 0);

-- 3. Dentists (chi tiết)
INSERT INTO `Dentists` (`user_id`, `years_of_exp`, `specialization`, `bio`, `is_verified`, `license_num`, `availability_schedule`) VALUES
('dent1', 10, 'Chỉnh nha (Niềng răng)', 'Bác sĩ Trịnh chuyên sâu về các giải pháp niềng răng, chỉnh nha thẩm mỹ.', 1, 'CCHN_001', '{"Monday": ["09:00-11:00", "14:00-17:00"], "Wednesday": ["09:00-17:00"]}'),
('dent2', 5, 'Nha khoa tổng quát', 'Bác sĩ Phương phụ trách khám tổng quát, cạo vôi răng, và trám răng.', 1, 'CCHN_002', '{"Tuesday": ["08:00-16:00"], "Thursday": ["08:00-16:00"]}');

-- 4. Clinics
INSERT INTO `Clinics` (`clinic_id`, `name`, `address`, `phone_number`, `email`, `description`, `is_verified`) VALUES
('clinic1', 'Nha khoa Sài Gòn Smile', '123 Đường Pasteur, Q1, TPHCM', '02811112222', 'info@sgsmile.com', 'Phòng khám nha khoa hàng đầu về dịch vụ niềng răng.', 1),
('clinic2', 'Nha khoa Quốc Tế Elite', '456 Đường Nguyễn Thị Minh Khai, Q3, TPHCM', '02833334444', 'contact@elite.com', 'Nha khoa tổng quát và thẩm mỹ.', 1);

-- 5. Services
INSERT INTO `Services` (`service_id`, `name`, `description`, `min_price`, `max_price`, `expected_duration_minutes`) VALUES
('serv1', 'Cạo vôi răng', 'Lấy sạch vôi răng và mảng bám, giúp răng sạch sẽ.', 200000, 400000, 30),
('serv2', 'Trám răng thẩm mỹ', 'Trám phục hồi răng sâu hoặc mẻ bằng vật liệu composite.', 300000, 800000, 45),
('serv3', 'Niềng răng mắc cài', 'Sử dụng hệ thống mắc cài để điều chỉnh răng về đúng vị trí.', 30000000, 50000000, 180);

-- ==========================================================
-- DỮ LIỆU QUAN HỆ N:N
-- ==========================================================

-- 8. Clinic_Dentists (Nha sĩ làm việc tại Phòng khám)
INSERT INTO `Clinic_Dentists` (`clinic_id`, `dentist_id`) VALUES
('clinic1', 'dent1'), -- BS Trịnh làm ở PK Sài Gòn
('clinic1', 'dent2'), -- BS Phương làm ở PK Sài Gòn
('clinic2', 'dent2'); -- BS Phương cũng làm ở PK Elite

-- 9. Clinic_Services (Phòng khám cung cấp Dịch vụ)
INSERT INTO `Clinic_Services` (`clinic_id`, `service_id`) VALUES
('clinic1', 'serv1'), -- PK Sài Gòn: Cạo vôi
('clinic1', 'serv2'), -- PK Sài Gòn: Trám răng
('clinic1', 'serv3'), -- PK Sài Gòn: Niềng răng
('clinic2', 'serv1'), -- PK Elite: Cạo vôi
('clinic2', 'serv2'); -- PK Elite: Trám răng

-- 10. Dentist_Services (Nha sĩ chuyên về Dịch vụ)
INSERT INTO `Dentist_Services` (`dentist_id`, `service_id`) VALUES
('dent1', 'serv3'), -- BS Trịnh chuyên Niềng răng
('dent2', 'serv1'), -- BS Phương chuyên Cạo vôi
('dent2', 'serv2'); -- BS Phương chuyên Trám răng

-- ==========================================================
-- DỮ LIỆU NGHIỆP VỤ (LỊCH HẸN & ĐÁNH GIÁ)
-- ==========================================================

-- 6. Appointments
INSERT INTO `Appointments` (`appointment_id`, `customer_id`, `dentist_id`, `clinic_id`, `appointment_datetime`, `status`, `notes`) VALUES
('app1', 'cust1', 'dent2', 'clinic1', '2025-11-10 10:00:00', 'Completed', 'Khám lần đầu'),
('app2', 'cust2', 'dent1', 'clinic1', '2025-11-12 14:00:00', 'Confirmed', 'Tư vấn niềng răng'),
('app3', 'cust1', 'dent2', 'clinic2', '2025-11-15 09:30:00', 'Pending', 'Trám răng mẻ');

-- 11. Appointment_Services (Dịch vụ cho từng Lịch hẹn)
INSERT INTO `Appointment_Services` (`appointment_id`, `service_id`) VALUES
('app1', 'serv1'), -- Lịch hẹn 1 là để Cạo vôi răng
('app2', 'serv3'), -- Lịch hẹn 2 là để Niềng răng
('app3', 'serv2'); -- Lịch hẹn 3 là để Trám răng

-- 7. Reviews (Đánh giá cho lịch hẹn đã hoàn thành)
INSERT INTO `Reviews` (`review_id`, `appointment_id`, `customer_id`, `dentist_id`, `clinic_id`, `rating`, `comment`, `is_verified`) VALUES
('rev1', 'app1', 'cust1', 'dent2', 'clinic1', 5, 'Bác sĩ Phương làm rất nhẹ nhàng, cẩn thận. Phòng khám sạch sẽ.', 1);