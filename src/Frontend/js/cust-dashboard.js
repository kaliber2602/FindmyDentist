const API_AUTH_BASE = "http://localhost:8000/api/auth";
const API_PROFILE_BASE = "http://localhost:8000/api/profile";
// (TODO) Cần thêm API URL cho các service khác
// const API_USER_URL = "http://localhost:8000/api/users";
// const API_APPOINTMENT_URL = "http://localhost:8000/api/appointments";

let currentCustomer = null; // Biến lưu thông tin user

/**
 * HÀM 1: BẢO VỆ TRANG (Auth Guard)
 */
async function checkCustomerAuth() {
  try {
    const response = await fetch(`${API_AUTH_BASE}/me`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      
        if (data.role === 'CUSTOMER') {
        currentCustomer = data; // Lưu user minimal
        // (MỚI) Bắt đầu tải thông tin Profile từ profile service
        loadDashboardData();
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
  try {
    // Gọi API profile/me qua API Gateway (cookie JWT sẽ được gửi)
    const profileResp = await fetch(`${API_PROFILE_BASE}/me`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    if (!profileResp.ok) {
      throw new Error('Không thể tải profile');
    }

    const json = await profileResp.json();
    const profileData = json.profile || {};

    // Merge vào currentCustomer để dùng ở các view
    currentCustomer = Object.assign({}, currentCustomer || {}, profileData);

    // Cập nhật UI
    document.getElementById('userName').textContent = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
    document.getElementById('userEmail').textContent = profileData.email || '';

    // Tải view "Profile" làm mặc định
    loadContent('profile', profileData);
  } catch (err) {
    console.error('Lỗi khi tải profile:', err);
    // Fallback: show minimal info
    const fallback = { first_name: '', last_name: '', email: '', phone_number: '' };
    loadContent('profile', fallback);
  }
}

/**
 * HÀM 3: Tải nội dung chính (Xử lý click sidebar)
 */
async function loadContent(viewName, data) {
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
                <div class="col-12 mt-4">
                  <button type="submit" class="btn btn-primary">Cập nhật thông tin</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      `;
      // Handle profile form submit
      document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const data = {
          first_name: form.querySelectorAll('input')[1].value,
          last_name: form.querySelectorAll('input')[0].value,
          phone_number: form.querySelectorAll('input')[3].value
        };
        try {
          const resp = await fetch(`${API_PROFILE_BASE}/me`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify(data)
          });
          if (resp.ok) {
            alert('Cập nhật thành công');
            // reload profile
            loadDashboardData();
          } else {
            const j = await resp.json();
            alert('Lỗi: ' + (j.detail || resp.status));
          }
        } catch (err) {
          console.error(err);
          alert('Lỗi khi cập nhật profile');
        }
      });
      break;
      
    case 'appointments':
      contentArea.innerHTML = `<h2 class="h3">Lịch hẹn của tôi</h2><div id="appointmentsList">Đang tải...</div>`;
      // Load appointments from API
      try {
        const resp = await fetch(`${API_PROFILE_BASE}/me/appointments`, {method: 'GET', credentials: 'include'});
        if (!resp.ok) throw new Error('Không thể tải lịch hẹn');
        const j = await resp.json();
        const list = j.appointments || [];
        const container = document.getElementById('appointmentsList');
        if (list.length === 0) {
          container.innerHTML = '<p>Chưa có lịch hẹn.</p>';
        } else {
          container.innerHTML = list.map(a => {
            const dt = new Date(a.appointment_datetime).toLocaleString();
            const services = (a.services || []).map(s => s.name).join(', ');
            const dentist = a.dentist_first || '';
            return `
              <div class="card mb-3">
                <div class="card-body">
                  <h5 class="card-title">${services}</h5>
                  <p class="card-text text-primary fw-semibold mb-1">${a.clinic_name || ''}</p>
                  <p class="card-text text-muted mb-2">Bác sĩ: ${dentist}</p>
                  <h6 class="text-dark">${dt} - <span class="text-muted">${a.status}</span></h6>
                </div>
              </div>
            `;
          }).join('');
        }
      } catch (err) {
        console.error(err);
        document.getElementById('appointmentsList').innerHTML = '<p>Lỗi khi tải lịch hẹn.</p>';
      }
      break;

    case 'history':
      contentArea.innerHTML = `<h2 class="h3">Lịch sử khám</h2><div id="historyList">Đang tải...</div>`;
      try {
        const resp = await fetch(`${API_PROFILE_BASE}/me/history`, {method: 'GET', credentials: 'include'});
        if (!resp.ok) throw new Error('Không thể tải lịch sử');
        const j = await resp.json();
        const list = j.history || [];
        const container = document.getElementById('historyList');
        if (list.length === 0) {
          container.innerHTML = '<p>Chưa có lịch sử khám nào.</p>';
        } else {
          container.innerHTML = list.map(a => {
            const dt = new Date(a.appointment_datetime).toLocaleString();
            const review = a.review ? `<p>Đánh giá: ${a.review.rating} - ${a.review.comment}</p>` : '';
            return `
              <div class="card mb-3">
                <div class="card-body">
                  <h5 class="card-title">${a.clinic_name || ''}</h5>
                  <p class="card-text text-muted mb-2">${dt}</p>
                  ${review}
                </div>
              </div>
            `;
          }).join('');
        }
      } catch (err) {
        console.error(err);
        document.getElementById('historyList').innerHTML = '<p>Lỗi khi tải lịch sử.</p>';
      }
      break;
      
    case 'settings':
      contentArea.innerHTML = `
        <h2 class="h3">Đổi mật khẩu</h2>
        <div class="card mt-4">
          <div class="card-body p-4">
            <form id="passwordForm">
              <div class="mb-3">
                <label class="form-label">Mật khẩu cũ</label>
                <input id="oldPassword" type="password" class="form-control" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Mật khẩu mới</label>
                <input id="newPassword" type="password" class="form-control" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Xác nhận mật khẩu mới</label>
                <input id="confirmPassword" type="password" class="form-control" required>
              </div>
              <button type="submit" class="btn btn-primary">Đổi mật khẩu</button>
            </form>
          </div>
        </div>
      `;
      document.getElementById('passwordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldP = document.getElementById('oldPassword').value;
        const newP = document.getElementById('newPassword').value;
        const conf = document.getElementById('confirmPassword').value;
        if (newP !== conf) { alert('Mật khẩu mới không khớp'); return; }
        try {
          const resp = await fetch(`${API_PROFILE_BASE}/me/change-password`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify({old_password: oldP, new_password: newP})
          });
          if (resp.ok) { alert('Đổi mật khẩu thành công'); }
          else { const j = await resp.json(); alert('Lỗi: ' + (j.detail || resp.status)); }
        } catch (err) { console.error(err); alert('Lỗi khi đổi mật khẩu'); }
      });
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
      const profileData = {
        first_name: currentCustomer?.first_name || "Nguyễn Văn",
        last_name: currentCustomer?.last_name || "A",
        email: currentCustomer?.email || "...",
        phone_number: currentCustomer?.phone_number || "..."
      };
      
      loadContent(view, profileData);
    });
  });
});