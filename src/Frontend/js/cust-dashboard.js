  const API_BASE_URL = "http://localhost:8000/api/auth";
  // (TODO) Cần thêm API URL cho các service khác
  const API_USER_URL = "http://localhost:8000/api/users";
  const API_CUSTOMER_URL = "http://localhost:8000/api/customers";
  const API_CUS_URL = "http://127.0.0.1:8005/customers";
  const API_APPOINTMENT_URL = "http://127.0.0.1:8003/appointments";
  //const API_APPOINTMENT_URL = "http://localhost:8000/api/appointments";

  let currentCustomer = null; // Biến lưu thông tin user

  /**
   * HÀM 1: BẢO VỆ TRANG (Auth Guard)
   */
  async function checkCustomerAuth() {
    try {
      const response = await fetch(`${API_BASE_URL}/me`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.role === 'CUSTOMER') {
          currentCustomer = data; // Lưu user
          // (MỚI) Bắt đầu tải thông tin Profile
          loadDashboardData(data.user_id);
          loadAppointmentsData(data.user_id);
        } else {
          // Là ADMIN hoặc DENTIST, không có quyền
          alert('Trang này chỉ dành cho khách hàng.');
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
      // (TODO) Bước tiếp theo là tạo API /api/users/{user_id}
      const profileResponse = await fetch(`${API_CUS_URL}/${userId}`);
      const profileData = await profileResponse.json();
    
      // (Giả lập) Dùng data từ /me và dữ liệu giả
      // const profileData = {
      //     first_name: "Nguyễn Văn",
      //     last_name: "A",
      //     email: "example@gmail.com", // (Nên lấy từ API)
      //     phone_number: "0901234567"
      // }

      // Cập nhật UI
      document.getElementById('userName').textContent = `${profileData.first_name} ${profileData.last_name}`;
      document.getElementById('userEmail').textContent = profileData.email;
      
      // Tải view "Profile" làm mặc định
      loadContent('profile', profileData);
  }
  async function loadAppointmentsData(userId) {
      // (TODO) Bước tiếp theo là tạo API /api/appointments/customer/{user_id}
      const appointmentsResponse = await fetch(`${API_APPOINTMENT_URL}/customer/${userId}`);
      const appointmentsData = await appointmentsResponse.json();

      // Xử lý dữ liệu lịch hẹn (nếu cần)
      loadContent('appointments', appointmentsData);
  }
  async function loadHistoryData(userId) {
      // (TODO) Tạo API /api/appointments/history/{user_id} nếu cần
      const historyResponse = await fetch(`${API_APPOINTMENT_URL}/history/${userId}`);
      const historyData = await historyResponse.json();
      loadContent('history', historyData);
  }

  async function loadSettingsData(userId) {
      // (TODO) Tạo API /api/customers/settings/{user_id} nếu cần
      const settingsResponse = await fetch(`${API_CUS_URL}/settings/${userId}`);
      const settingsData = await settingsResponse.json();
      loadContent('settings', settingsData);
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
          <h2 class="h3">Thông tin tài khoản</h2>
          <div class="card mt-4">
            <div class="card-body p-4">
              <form id="profileForm">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Họ</label>
                    <input type="text" class="form-control" value="${data.first_name || ''}">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Tên</label>
                    <input type="text" class="form-control" value="${(data.middle_name +" "+ data.last_name ) || ''}">
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
                    <label class="form-label">Căn cước công dân</label>
                    <input type="text" class="form-control" value="${data.cccd_num || ''}">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Địa chỉ</label>
                    <input type="text" class="form-control" value="${data.address || ''}">
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Ngày sinh</label>
                    <input type="text" class="form-control" value="${data.date_of_birth || ''}">
                  </div>
                  <div class="col-12 mt-4">
                    <button type="submit" class="btn btn-primary">Cập nhật thông tin</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        `;
        break;
        
      case 'appointments':
        contentArea.innerHTML = `
          <h2 class="h3">Lịch hẹn của tôi</h2>
          <div class="card appointment-card">
            <div class="card-body">
              <h5 class="card-title">Khám tổng quát (Dữ liệu mẫu)</h5>
              <p class="card-text text-primary fw-semibold mb-1">Nha khoa BrightSmile</p>
              <p class="card-text text-muted mb-2"><i class="bi bi-geo-alt-fill me-2"></i>123 Đường ABC, Q.1</p>
              <h6 class="text-dark">Thứ Hai, 10/11/2025 - 10:00 AM</h6>
            </div>
          </div>
        `;
        // (TODO: Gọi API để tải lịch hẹn thật)
        break;

      case 'history':
        contentArea.innerHTML = `
          <h2 class="h3">Lịch sử khám</h2>
          <div class="card mt-4">
            <div class="card-body text-center p-5">
              <i class="bi bi-clipboard-data-fill fs-1 text-muted"></i>
              <p class="mt-3">Chưa có lịch sử khám nào.</p>
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
        contentArea.innerHTML = `<p>Trang không tìm thấy.</p>`;
    }
  }

  /**
   * HÀM 4: ĐĂNG XUẤT
   */
  async function handleLogout() {
    try {
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
    checkCustomerAuth();

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
        // (Tải lại dữ liệu giả)
        // (Sau này bạn sẽ tải dữ liệu thật từ API tại đây)
        if(view === 'appointments') {
          loadAppointmentsData(currentCustomer.user_id);
          return;
        }else if(view === 'profile') {
          loadDashboardData(currentCustomer.user_id);
          return;
        }else if(view === 'history') {
          loadContent('history', {});
          return;
        }else if(view === 'settings') {
          loadContent('settings', {});
          return;
        }
        

        loadContent(view, profileData);
      });
    });
  });