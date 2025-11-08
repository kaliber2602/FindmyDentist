const API_BASE_URL = "http://localhost:8000/api/auth";
// (TODO) Thêm API URL cho các service khác khi cần
// const API_DENTIST_URL = "http://localhost:8000/api/dentists"; 
// const API_APPOINTMENT_URL = "http://localhost:8000/api/appointments";

let currentDentist = null; // Biến lưu thông tin nha sĩ

/**
 * HÀM 1: BẢO VỆ TRANG (Auth Guard)
 * Kiểm tra xem phải DENTIST không
 */
async function checkDentistAuth() {
  try {
    const response = await fetch(`${API_BASE_URL}/me`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      
      if (data.role === 'DENTIST') {
        currentDentist = data; // Lưu user
        // Bắt đầu tải thông tin Profile
        loadDashboardData(data.user_id);
      } else {
        // Là ADMIN hoặc CUSTOMER, không có quyền
        alert('Trang này chỉ dành cho Nha sĩ.');
        window.location.href = 'index.html';
      }
    } else {
      // (Chưa đăng nhập) Đá về trang chủ
      alert('Vui lòng đăng nhập để xem trang này.');
      window.location.href = 'index.html';
    }
  } catch (error) {
    console.error('Lỗi xác thực:', error);
    window.location.href = 'index.html';
  }
}

/**
 * HÀM 2: Tải dữ liệu ban đầu cho Dashboard
 */
async function loadDashboardData(userId) {
    // (TODO) Bước tiếp theo là tạo API /api/users/{user_id} hoặc /api/dentists/{user_id}
    // const profileResponse = await fetch(`${API_DENTIST_URL}/${userId}`);
    // const profileData = await profileResponse.json();
    
    // (Giả lập) Dùng data từ /me và dữ liệu giả
    const profileData = {
        first_name: "Nguyễn", // <-- SỬA LỖI: Bỏ "Dr." ở đây
        last_name: "Văn B",
        email: "dentist@example.com", // (Nên lấy từ API)
        phone_number: "0908889999",
        specialization: "Orthodontics",
        years_of_exp: 10,
        bio: "Chuyên gia niềng răng với 10 năm kinh nghiệm."
    };

    // Cập nhật UI (Sẽ hiển thị "Dr. Nguyễn Văn B")
    document.getElementById('dentistName').textContent = `Dr. ${profileData.first_name} ${profileData.last_name}`;
    document.getElementById('dentistEmail').textContent = profileData.email;
    
    // Tải view "Profile" làm mặc định
    loadContent('profile', profileData);
}

/**
 * HÀM 3: Tải nội dung chính (Xử lý click sidebar)
 */
function loadContent(viewName, data) {
  const contentArea = document.getElementById('dashboardContentArea');
  contentArea.innerHTML = ""; // Xóa nội dung cũ

  switch (viewName) {
    case 'profile':
      contentArea.innerHTML = `
        <h2 class="h3">Hồ sơ chuyên môn</h2>
        <div class="card mt-4">
          <div class="card-body p-4">
            <form id="profileForm">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">Họ</label>
                  <input type="text" class="form-control" value="${data.last_name || ''}">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Tên</label>
                  <input type="text" class="form-control" value="${data.first_name || ''}">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Email</label>
                  <input type="email" class="form-control" value="${data.email || ''}" disabled>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Số điện thoại</label>
                  <input type="tel" class="form-control" value="${data.phone_number || ''}">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Chuyên khoa</label>
                  <input type="text" class="form-control" value="${data.specialization || ''}">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Số năm kinh nghiệm</label>
                  <input type="number" class="form-control" value="${data.years_of_exp || 0}">
                </div>
                <div class="col-12">
                  <label class="form-label">Giới thiệu (Bio)</label>
                  <textarea class="form-control" rows="4">${data.bio || ''}</textarea>
                </div>
                <div class="col-12 mt-4">
                  <button type="submit" class="btn btn-primary">Cập nhật hồ sơ</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      `;
      break;
      
    case 'appointments':
      contentArea.innerHTML = `
        <h2 class="h3">Quản lý lịch hẹn</h2>
        <p class="text-muted">Xem các lịch hẹn đang chờ xác nhận hoặc đã đặt.</p>
        <div class="card mt-4">
          <div class="card-body text-center p-5">
            <i class="bi bi-calendar-x fs-1 text-muted"></i>
            <p class="mt-3">Chưa có lịch hẹn nào.</p>
          </div>
        </div>
      `;
      break;

    case 'schedule':
      contentArea.innerHTML = `
        <h2 class="h3">Lịch làm việc</h2>
        <p class="text-muted">Thiết lập các khung giờ bạn sẵn sàng nhận lịch hẹn.</p>
        <div class="card mt-4">
          <div class="card-body p-4">
            <h5>Coming soon...</h5>
            <p>Tính năng cài đặt lịch làm việc đang được phát triển.</p>
          </div>
        </div>
      `;
      break;

    case 'clinic':
      contentArea.innerHTML = `
        <h2 class="h3">Phòng khám của tôi</h2>
        <p class="text-muted">Quản lý thông tin phòng khám liên kết.</p>
        <div class="card mt-4">
          <div class="card-body p-4">
             <h5>Nha khoa Sài Gòn Smile (Dữ liệu mẫu)</h5>
             <p>123 Đường Pasteur, Q1, TPHCM</p>
             <button class="btn btn-outline-primary">Quản lý dịch vụ</button>
          </div>
        </div>
      `;
      break;
      
    case 'settings':
      contentArea.innerHTML = `
        <h2 class="h3">Đổi mật khẩu</h2>
        <div class="card mt-4">
          <div class="card-body p-4">
            <form id="passwordForm">
              <div class="mb-3">
                <label class="form-label">Mật khẩu cũ</label>
                <input type="password" class="form-control" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Mật khẩu mới</label>
                <input type="password" class="form-control" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Xác nhận mật khẩu mới</label>
                <input type="password" class="form-control" required>
              </div>
              <button type="submit" class="btn btn-primary">Đổi mật khẩu</button>
            </form>
          </div>
        </div>
      `;
      break;
      
    default:
      // SỬA LỖI 1: Bỏ dấu `\` bị thừa
      contentArea.innerHTML = `<p>Trang không tìm thấy.</p>`;
  }
}

/**
 * HÀM 4: ĐĂNG XUẤT
 */
async function handleLogout() {
  try {
    // SỬA LỖI 2: Bỏ dấu `\` bị thừa
    await fetch(`${API_BASE_URL}/logout`, { method: 'POST' });
  } catch (error) {
    console.error('Lỗi khi logout:', error);
  } finally {
    window.location.href = 'index.html'; // Về trang chủ
  }
}

// === CHẠY KHI TẢI TRANG ===
document.addEventListener('DOMContentLoaded', () => {
  // 1. Chạy hàm bảo vệ NGAY LẬP TỨC
  checkDentistAuth();

  // 2. Gắn sự kiện cho nút Logout
  document.getElementById('logoutButton').addEventListener('click', handleLogout);

  // 3. Gắn sự kiện cho các link sidebar
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault(); // Ngăn tải lại trang

      // Bỏ 'active' khỏi tất cả link
      sidebarLinks.forEach(l => l.classList.remove('active'));
      // Thêm 'active' cho link vừa click
      link.classList.add('active');

      const view = link.getAttribute('data-view');
      
      // (Tải lại dữ liệu giả - TODO: thay bằng API thật)
      const profileData = {
        first_name: currentDentist.first_name || "Nguyễn", // Sửa mock data
        last_name: currentDentist.last_name || "Văn B",
        email: currentDentist.email || "...",
        phone_number: currentDentist.phone_number || "...",
        specialization: "Orthodontics",
        years_of_exp: 10,
        bio: "Chuyên gia niềng răng với 10 năm kinh nghiệm."
      };
      
      loadContent(view, profileData);
    });
  });
});