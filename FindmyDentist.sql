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
  `description` TEXT
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
  `price_range` VARCHAR(255),
  `expected_duration_minutes` INT,
  PRIMARY KEY (`appointment_id`, `service_id`),
  FOREIGN KEY (`appointment_id`) REFERENCES `Appointments`(`appointment_id`) ON DELETE CASCADE,
  FOREIGN KEY (`service_id`) REFERENCES `Services`(`service_id`) ON DELETE CASCADE
);


-- ==========================================================
-- Kích hoạt lại kiểm tra khóa ngoại
-- ==========================================================
SET FOREIGN_KEY_CHECKS=1;

-- ----------------------------
-- 1. Bảng Users (Đã gộp thông tin chung)
-- ----------------------------
INSERT INTO `Users` (`user_id`, `email`, `phone_number`, `password_hash`, `first_name`, `last_name`, `role`, `reputation_score`, `is_verified`, `is_ban`) VALUES
('cust1', 'van.nguyen@email.com', '090111222', 'hash123', 'Văn', 'Nguyễn', 'CUSTOMER', 100, 1, 0),
('cust2', 'thanh.tran@email.com', '090333444', 'hash456', 'Thanh', 'Trần', 'CUSTOMER', 90, 0, 0),
('dent1', 'bs.trinh@email.com', '080111222', 'hash789', 'Minh', 'Trịnh', 'DENTIST', 100, 1, 0),
('dent2', 'bs.phuong@email.com', '080333444', 'hashABC', 'Hoài', 'Phương', 'DENTIST', 100, 1, 0),
('admin1', 'admin@findmydentist.com', '0123456789', 'hashXYZ', 'Admin', 'User', 'ADMIN', 100, 1, 0);

-- ----------------------------
-- 2. Bảng Customers (Chi tiết)
-- ----------------------------
INSERT INTO `Customers` (`user_id`, `cccd_num`, `report_count`) VALUES
('cust1', '012345678901', 0),
('cust2', '098765432101', 1);

-- ----------------------------
-- 3. Bảng Dentists (Chi tiết)
-- ----------------------------
INSERT INTO `Dentists` (`user_id`, `years_of_exp`, `specialization`, `bio`, `is_verified`, `license_num`, `availability_schedule`) VALUES
('dent1', 10, 'Chỉnh nha (Niềng răng)', 'Bác sĩ Trịnh chuyên sâu về các giải pháp niềng răng.', 1, 'CCHN_001', '{"Monday": ["09:00-17:00"]}'),
('dent2', 5, 'Nha khoa tổng quát', 'Bác sĩ Phương phụ trách khám tổng quát, cạo vôi răng.', 1, 'CCHN_002', '{"Tuesday": ["08:00-16:00"]}');

-- ----------------------------
-- 4. Bảng Clinics (Đã thêm reputation và ban)
-- ----------------------------
INSERT INTO `Clinics` (`clinic_id`, `name`, `address`, `phone_number`, `email`, `description`, `is_verified`, `reputation_score`, `is_ban`) VALUES
('clinic1', 'Nha khoa Sài Gòn Smile', '123 Đường Pasteur, Q1, TPHCM', '02811112222', 'info@sgsmile.com', 'Phòng khám hàng đầu.', 1, 100, 0),
('clinic2', 'Nha khoa Quốc Tế Elite', '456 Đường Nguyễn Thị Minh Khai, Q3, TPHCM', '02833334444', 'contact@elite.com', 'Nha khoa tổng quát.', 1, 95, 0);

-- ----------------------------
-- 5. Bảng Services (Đã bỏ giá và thời gian)
-- ----------------------------
INSERT INTO `Services` (`service_id`, `name`, `description`) VALUES
('serv1', 'Cạo vôi răng', 'Lấy sạch vôi răng và mảng bám.'),
('serv2', 'Trám răng thẩm mỹ', 'Trám phục hồi răng sâu hoặc mẻ.'),
('serv3', 'Niềng răng mắc cài', 'Điều chỉnh răng về đúng vị trí.');

-- ----------------------------
-- 6. Bảng Appointments (Tạo lịch hẹn trước)
-- ----------------------------
INSERT INTO `Appointments` (`appointment_id`, `customer_id`, `dentist_id`, `clinic_id`, `appointment_datetime`, `status`) VALUES
('app1', 'cust1', 'dent2', 'clinic1', '2025-11-10 10:00:00', 'Completed'),
('app2', 'cust2', 'dent1', 'clinic1', '2025-11-12 14:00:00', 'Confirmed'),
('app3', 'cust1', 'dent2', 'clinic2', '2025-11-15 09:30:00', 'Pending');

-- ----------------------------
-- 7. Bảng Reviews (Đánh giá cho lịch hẹn đã hoàn thành)
-- ----------------------------
INSERT INTO `Reviews` (`review_id`, `appointment_id`, `customer_id`, `dentist_id`, `clinic_id`, `rating`, `comment`) VALUES
('rev1', 'app1', 'cust1', 'dent2', 'clinic1', 5, 'Bác sĩ Phương làm rất nhẹ nhàng, cẩn thận.');

-- ----------------------------
-- 8. Bảng Reports (MỚI - Dữ liệu mẫu)
-- ----------------------------
INSERT INTO `Reports` (`report_id`, `reporter_id`, `reported_entity_id`, `reported_entity_type`, `reason`, `status`) VALUES
('report1', 'cust2', 'clinic2', 'CLINIC', 'Phòng khám thu phí không đúng như tư vấn.', 'Pending'),
('report2', 'cust1', 'dent1', 'USER', 'Bác sĩ đến trễ 30 phút mà không báo trước.', 'Resolved');


-- ==========================================================
-- DỮ LIỆU QUAN HỆ N:N
-- ==========================================================

-- ----------------------------
-- 9. Clinic_Dentists (Nha sĩ làm ở đâu)
-- ----------------------------
INSERT INTO `Clinic_Dentists` (`clinic_id`, `dentist_id`) VALUES
('clinic1', 'dent1'),
('clinic1', 'dent2'),
('clinic2', 'dent2');

-- ----------------------------
-- 10. Clinic_Services (Phòng khám CÓ dịch vụ gì - KHÔNG CÓ GIÁ)
-- ----------------------------
INSERT INTO `Clinic_Services` (`clinic_id`, `service_id`) VALUES
('clinic1', 'serv1'),
('clinic1', 'serv2'),
('clinic1', 'serv3'),
('clinic2', 'serv1'),
('clinic2', 'serv2');

-- ----------------------------
-- 11. Dentist_Services (Nha sĩ CHUYÊN dịch vụ gì)
-- ----------------------------
INSERT INTO `Dentist_Services` (`dentist_id`, `service_id`) VALUES
('dent1', 'serv3'),
('dent2', 'serv1'),
('dent2', 'serv2');

-- ----------------------------
-- 12. Appointment_Services (CHI TIẾT LỊCH HẸN - CÓ GIÁ VÀ THỜI GIAN)
-- ----------------------------
INSERT INTO `Appointment_Services` (`appointment_id`, `service_id`, `price_range`, `expected_duration_minutes`) VALUES
('app1', 'serv1', '250.000 VNĐ', 30), -- Giá và thời gian thực tế của lịch hẹn app1
('app2', 'serv3', '30.000.000 - 45.000.000 VNĐ', 180), -- Giá và thời gian ước tính của lịch hẹn app2
('app3', 'serv2', '300.000 - 500.000 VNĐ', 45); -- Giá và thời gian ước tính của lịch hẹn app3

SET FOREIGN_KEY_CHECKS=1;