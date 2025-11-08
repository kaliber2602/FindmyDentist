const API_BASE_URL = "http://localhost:8000/api/auth";

// HÀM 1: BẢO VỆ TRANG ADMIN
async function checkAdminAuth() {
  try {
    // Gọi API /me. Vì trình duyệt tự gửi cookie,
    // API này sẽ trả về thông tin user nếu đã login
    const response = await fetch(`${API_BASE_URL}/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (response.ok) {
      const data = await response.json();
      // (QUAN TRỌNG) Kiểm tra role
      if (data.role !== 'ADMIN') {
        // Nếu là CUSTOMER hoặc DENTIST, đá về trang chủ
        alert('Bạn không có quyền truy cập trang này.');
        window.location.href = 'index.html';
      } else {
        // Nếu là ADMIN, hiển thị email (ví dụ)
        // (Bạn có thể gọi API khác để lấy chi tiết admin)
        console.log('Chào mừng Admin:', data.user_id);
      }
    } else {
      // Nếu lỗi (ví dụ: cookie hết hạn, chưa login)
      // đá về trang chủ
      window.location.href = 'index.html';
    }
  } catch (error) {
    // Lỗi mạng, cũng đá về trang chủ
    console.error('Lỗi xác thực:', error);
    window.location.href = 'index.html';
  }
}

// HÀM 2: ĐĂNG XUẤT
async function handleLogout() {
  try {
    await fetch(`${API_BASE_URL}/logout`, { method: 'POST' });
  } catch (error) {
    console.error('Lỗi khi logout:', error);
  } finally {
    // Dù logout lỗi hay không, cứ xóa cookie và về trang chủ
    window.location.href = 'index.html';
  }
}

// CHẠY KHI TẢI TRANG
document.addEventListener('DOMContentLoaded', () => {
  // 1. Chạy hàm bảo vệ NGAY LẬP TỨC
  checkAdminAuth();

  // 2. Gắn sự kiện cho nút Logout
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', handleLogout);
  }
});