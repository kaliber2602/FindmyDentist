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
  `user_id` VARCHAR(50) PRIMARY KEY,
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
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- (MỚI) Các trường được chuyển lên từ Customers/Dentists
  `reputation_score` INT DEFAULT 100,
  `is_verified` BOOLEAN DEFAULT FALSE,
  `is_ban` BOOLEAN DEFAULT FALSE
  
  -- (Ghi chú) Ràng buộc is_ban khi reputation = 0 sẽ được xử lý ở tầng ứng dụng (Application Layer)
);

-- ----------------------------
-- 2. Bảng Customers (Subtype) (ĐÃ CẬP NHẬT)
-- ----------------------------
DROP TABLE IF EXISTS `Customers`;
CREATE TABLE `Customers` (
  `user_id` VARCHAR(50) PRIMARY KEY,
  `cccd_num` VARCHAR(20) UNIQUE,
  `report_count` INT DEFAULT 0,
  -- (ĐÃ XÓA) reputation_score, ban_status, is_verified (đã chuyển lên Users)
  FOREIGN KEY (`user_id`) REFERENCES `Users`(`user_id`) ON DELETE CASCADE
);

-- ----------------------------
-- 3. Bảng Dentists (Subtype) (ĐÃ CẬP NHẬT)
-- ----------------------------
DROP TABLE IF EXISTS `Dentists`;
CREATE TABLE `Dentists` (
  `user_id` VARCHAR(50) PRIMARY KEY,
  `years_of_exp` INT DEFAULT 0,
  `specialization` VARCHAR(255),
  `average_rating` FLOAT DEFAULT 0.0,
  `bio` TEXT,
  `social_link` VARCHAR(255),
  `availability_schedule` JSON,
  `license_num` VARCHAR(100) UNIQUE,
  -- (ĐÃ XÓA) is_verified (đã chuyển lên Users)
  FOREIGN KEY (`user_id`) REFERENCES `Users`(`user_id`) ON DELETE CASCADE
);

-- ----------------------------
-- 4. Bảng Clinics (ĐÃ CẬP NHẬT)
-- ----------------------------
DROP TABLE IF EXISTS `Clinics`;
CREATE TABLE `Clinics` (
  `clinic_id` VARCHAR(50) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `address` TEXT NOT NULL,
  `phone_number` VARCHAR(20),
  `email` VARCHAR(255),
  `opening_hours` JSON,
  `description` TEXT,
  `images` JSON,
  `total_reviews` INT DEFAULT 0,
  `average_rating` FLOAT DEFAULT 0.0,
  `is_verified` BOOLEAN DEFAULT FALSE,
  
  -- (MỚI) Thêm trường uy tín và ban cho Clinics
  `reputation_score` INT DEFAULT 100,
  `is_ban` BOOLEAN DEFAULT FALSE
);

-- ----------------------------
-- 5. Bảng Services
-- ----------------------------
DROP TABLE IF EXISTS `Services`;
CREATE TABLE `Services` (
  `service_id` VARCHAR(50) PRIMARY KEY,
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
  `appointment_id` VARCHAR(50) PRIMARY KEY,
  `customer_id` VARCHAR(50),
  `dentist_id` VARCHAR(50),
  `clinic_id` VARCHAR(50),
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
  `review_id` VARCHAR(50) PRIMARY KEY,
  `appointment_id` VARCHAR(50) NOT NULL UNIQUE,
  `customer_id` VARCHAR(50),
  `dentist_id` VARCHAR(50),
  `clinic_id` VARCHAR(50),
  `rating` TINYINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  `comment` TEXT,
  `is_verified` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`appointment_id`) REFERENCES `Appointments`(`appointment_id`) ON DELETE CASCADE,
  FOREIGN KEY (`customer_id`) REFERENCES `Users`(`user_id`) ON DELETE SET NULL,
  FOREIGN KEY (`dentist_id`) REFERENCES `Users`(`user_id`) ON DELETE SET NULL,
  FOREIGN KEY (`clinic_id`) REFERENCES `Clinics`(`clinic_id`) ON DELETE SET NULL
);

-- ----------------------------
-- 8. Bảng Reports (MỚI)
-- ----------------------------
DROP TABLE IF EXISTS `Reports`;
CREATE TABLE `Reports` (
  `report_id` VARCHAR(50) PRIMARY KEY,
  `reporter_id` VARCHAR(50), -- Người tạo report (FK tới Users)
  `reported_entity_id` VARCHAR(50) NOT NULL, -- ID của User hoặc Clinic bị report
  `reported_entity_type` ENUM('USER', 'CLINIC') NOT NULL, -- Loại bị report
  `reason` TEXT NOT NULL, -- Nội dung report
  `status` ENUM('Pending', 'Resolved', 'Dismissed') DEFAULT 'Pending',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`reporter_id`) REFERENCES `Users`(`user_id`) ON DELETE SET NULL
  -- Ghi chú: Không thể đặt FK cho `reported_entity_id` vì nó tham chiếu 2 bảng (Users, Clinics)
);


-- ==========================================================
-- BẢNG TRUNG GIAN (CHO QUAN HỆ N:N)
-- ==========================================================

-- ----------------------------
-- 9. Clinic_Dentists
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
-- 10. Clinic_Services
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
-- 11. Dentist_Services
-- ----------------------------
DROP TABLE IF EXISTS `Dentist_Services`;
CREATE TABLE `Dentist_Services` (
  `dentist_id` VARCHAR(50),
  `service_id` VARCHAR(50),
  PRIMARY KEY (`dentist_id`, `service_id`),
  FOREIGN KEY (`dentist_id`) REFERENCES `Users`(`user_id`) ON DELETE CASCADE,
  FOREIGN KEY (`service_id`) REFERENCES `Services`(`service_id`) ON DELETE CASCADE
);

-- ----------------------------
-- 12. Appointment_Services
-- ----------------------------
DROP TABLE IF EXISTS `Appointment_Services`;
CREATE TABLE `Appointment_Services` (
  `appointment_id` VARCHAR(50),
  `service_id` VARCHAR(50),
  PRIMARY KEY (`appointment_id`, `service_id`),
  FOREIGN KEY (`appointment_id`) REFERENCES `Appointments`(`appointment_id`) ON DELETE CASCADE,
  FOREIGN KEY (`service_id`) REFERENCES `Services`(`service_id`) ON DELETE CASCADE
);


-- ==========================================================
-- Kích hoạt lại kiểm tra khóa ngoại
-- ==========================================================
SET FOREIGN_KEY_CHECKS=1;


-- ==========================================================
-- DỮ LIỆU MẪU (INSERT DATA) (ĐÃ CẬP NHẬT)
-- ==========================================================

-- (Dữ liệu mẫu cho Users đã bị xóa khỏi file SQL gốc của bạn,
--  nhưng chúng ta cần chúng để các FK hoạt động)
INSERT INTO `Users` (`user_id`, `email`, `password_hash`, `first_name`, `last_name`, `role`, `is_verified`) VALUES
('cust1', 'customer1@gmail.com', '$2b$12$EXAMPLEHASH', 'Văn', 'Nguyễn', 'CUSTOMER', 1),
('cust2', 'customer2@gmail.com', '$2b$12$EXAMPLEHASH', 'Thị', 'Trần', 'CUSTOMER', 1),
('dent1', 'dentist1@gmail.com', '$2b$12$EXAMPLEHASH', 'Anh', 'Trịnh', 'DENTIST', 1),
('dent2', 'dentist2@gmail.com', '$2b$12$EXAMPLEHASH', 'Minh', 'Phương', 'DENTIST', 1),
('admin1', 'admin@gmail.com', '$2b$12$EXAMPLEHASH', 'Admin', 'User', 'ADMIN', 1);


-- 2. Customers (chi tiết) (Đã cập nhật)
INSERT INTO `Customers` (`user_id`, `cccd_num`) VALUES
('cust1', '012345678901'),
('cust2', '098765432101');

-- 3. Dentists (chi tiết) (Đã cập nhật)
INSERT INTO `Dentists` (`user_id`, `years_of_exp`, `specialization`, `bio`, `license_num`, `availability_schedule`) VALUES
('dent1', 10, 'Chỉnh nha (Niềng răng)', 'Bác sĩ Trịnh chuyên sâu về các giải pháp niềng răng, chỉnh nha thẩm mỹ.', 'CCHN_001', '{"Monday": ["09:00-11:00", "14:00-17:00"], "Wednesday": ["09:00-17:00"]}'),
('dent2', 5, 'Nha khoa tổng quát', 'Bác sĩ Phương phụ trách khám tổng quát, cạo vôi răng, và trám răng.', 'CCHN_002', '{"Tuesday": ["08:00-16:00"], "Thursday": ["08:00-16:00"]}');

-- 4. Clinics
INSERT INTO `Clinics` (`clinic_id`, `name`, `address`, `phone_number`, `email`, `description`, `is_verified`) VALUES
('clinic1', 'Nha khoa Sài Gòn Smile', '123 Đường Pasteur, Q1, TPHCM', '02811112222', 'info@sgsmile.com', 'Phòng khám nha khoa hàng đầu về dịch vụ niềng răng.', 1),
('clinic2', 'Nha khoa Quốc Tế Elite', '456 Đường Nguyễn Thị Minh Khai, Q3, TPHCM', '02833334444', 'contact@elite.com', 'Nha khoa tổng quát và thẩm mỹ.', 1);

-- 5. Services
INSERT INTO `Services` (`service_id`, `name`, `description`, `min_price`, `max_price`, `expected_duration_minutes`) VALUES
('serv1', 'Cạo vôi răng', 'Lấy sạch vôi răng và mảng bám, giúp răng sạch sẽ.', 200000, 400000, 30),
('serv2', 'Trám răng thẩm mỹ', 'Trám phục hồi răng sâu hoặc mẻ bằng vật liệu composite.', 300000, 800000, 45),
('serv3', 'Niềng răng mắc cài', 'Sử dụng hệ thống mắc cài để điều chỉnh răng về đúng vị trí.', 30000000, 50000000, 180);

-- 8. Clinic_Dentists
INSERT INTO `Clinic_Dentists` (`clinic_id`, `dentist_id`) VALUES
('clinic1', 'dent1'),
('clinic1', 'dent2'),
('clinic2', 'dent2');

-- 9. Clinic_Services
INSERT INTO `Clinic_Services` (`clinic_id`, `service_id`) VALUES
('clinic1', 'serv1'),
('clinic1', 'serv2'),
('clinic1', 'serv3'),
('clinic2', 'serv1'),
('clinic2', 'serv2');

-- 10. Dentist_Services
INSERT INTO `Dentist_Services` (`dentist_id`, `service_id`) VALUES
('dent1', 'serv3'),
('dent2', 'serv1'),
('dent2', 'serv2');

-- 6. Appointments
INSERT INTO `Appointments` (`appointment_id`, `customer_id`, `dentist_id`, `clinic_id`, `appointment_datetime`, `status`, `notes`) VALUES
('app1', 'cust1', 'dent2', 'clinic1', '2025-11-10 10:00:00', 'Completed', 'Khám lần đầu'),
('app2', 'cust2', 'dent1', 'clinic1', '2025-11-12 14:00:00', 'Confirmed', 'Tư vấn niềng răng'),
('app3', 'cust1', 'dent2', 'clinic2', '2025-11-15 09:30:00', 'Pending', 'Trám răng mẻ');

-- 11. Appointment_Services
INSERT INTO `Appointment_Services` (`appointment_id`, `service_id`) VALUES
('app1', 'serv1'),
('app2', 'serv3'),
('app3', 'serv2');

-- 7. Reviews
INSERT INTO `Reviews` (`review_id`, `appointment_id`, `customer_id`, `dentist_id`, `clinic_id`, `rating`, `comment`, `is_verified`) VALUES
('rev1', 'app1', 'cust1', 'dent2', 'clinic1', 5, 'Bác sĩ Phương làm rất nhẹ nhàng, cẩn thận. Phòng khám sạch sẽ.', 1);

-- 8. Reports (Dữ liệu mẫu mới)
INSERT INTO `Reports` (`report_id`, `reporter_id`, `reported_entity_id`, `reported_entity_type`, `reason`, `status`) VALUES
('rep1', 'cust1', 'dent2', 'USER', 'Nha sĩ đến trễ 30 phút mà không báo trước.', 'Pending'),
('rep2', 'cust2', 'clinic1', 'CLINIC', 'Phòng khám thu thêm phí vô lý không báo trước.', 'Pending');