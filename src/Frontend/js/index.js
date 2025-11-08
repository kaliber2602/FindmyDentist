// Định nghĩa API URL
const API_BASE_URL = "http://localhost:8000/api/auth";

/**
 * HÀM MỚI: Kiểm tra trạng thái đăng nhập khi tải trang
 * Gọi API /me để xem ai đang đăng nhập (nếu có)
 */
async function checkLoginStatus() {
  // Lấy các element trên Navbar
  const loginButton = document.getElementById("loginButtonContainer");
  const logoutButton = document.getElementById("logoutButtonContainer");
  const customerDashboardLink = document.getElementById("customerDashboardLink");

  try {
    const response = await fetch(`${API_BASE_URL}/me`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      // === ĐÃ ĐĂNG NHẬP ===
      const data = await response.json();

      // Ẩn nút Login
      if(loginButton) loginButton.classList.add('d-none');
      // Hiện nút Logout
      if(logoutButton) logoutButton.classList.remove('d-none');

      // Nếu là CUSTOMER, hiện link "Lịch hẹn"
      if (data.role === 'CUSTOMER') {
        if(customerDashboardLink) customerDashboardLink.classList.remove('d-none');
      }
      
    } else {
      // === CHƯA ĐĂNG NHẬP ===
      // (Không làm gì cả, giữ nguyên trạng thái mặc định)
      // Chỉ cần đảm bảo nút Login hiện (phòng trường hợp)
      if(loginButton) loginButton.classList.remove('d-none');
      if(logoutButton) logoutButton.classList.add('d-none');
      if(customerDashboardLink)customerDashboardLink.classList.add('d-none');
    }
  } catch (error) {
    // Lỗi mạng (ví dụ: API Gateway sập)
    console.error("Không thể kết nối API /me", error);
    // Giữ trạng thái logout
    if(loginButton) loginButton.classList.remove('d-none');
    if(logoutButton) logoutButton.classList.add('d-none');
    if(customerDashboardLink) customerDashboardLink.classList.add('d-none');
  }
}

/**
 * HÀM MỚI: Xử lý Đăng xuất
 */
async function handleLogout() {
  try {
    await fetch(`${API_BASE_URL}/logout`, { method: 'POST' });
  } catch (error) {
    console.error('Lỗi khi logout:', error);
  } finally {
    // Sau khi gọi API (dù thành công hay lỗi),
    // tải lại trang để reset về trạng thái logout
    window.location.reload();
  }
}

/**
 * HÀM GỐC: Xử lý Đăng nhập (Giữ nguyên)
 */
async function handleLogin() {
  const email = document.getElementById("email").value.trim();
  const pass = document.getElementById("password").value.trim();
  const messageEl = document.getElementById("loginMessage");

  if (!email || !pass) {
    messageEl.textContent = "Vui lòng nhập email và mật khẩu.";
    messageEl.className = "text-danger small";
    return;
  }

  messageEl.textContent = "Đang đăng nhập...";
  messageEl.className = "text-muted small";

  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: pass }),
    });

    const data = await response.json();

    if (response.ok) {
      // Đăng nhập thành công, backend đã set cookie
      if (data.user && data.user.role === "ADMIN") {
        window.location.href = "admin.html"; // Chuyển hướng Admin
      } else if (data.user && data.user.role === "DENTIST") {
        window.location.href = "dent-dashboard.html"; 
      }else {
        // Là CUSTOMER, tải lại trang index
        // Trang index sẽ chạy checkLoginStatus() và hiện UI mới
        window.location.reload(); 
      }
    } else {
      messageEl.textContent = data.detail || "Email hoặc mật khẩu không chính xác.";
      messageEl.className = "text-danger small";
    }
  } catch (error) {
    console.error("Lỗi khi đăng nhập:", error);
    messageEl.textContent = "Không thể kết nối đến máy chủ. Vui lòng thử lại.";
    messageEl.className = "text-danger small";
  }
}

// === HÀM CHẠY KHI TẢI TRANG ===
document.addEventListener("DOMContentLoaded", function () {
  
  // (MỚI) 1. Kiểm tra trạng thái đăng nhập ngay lập tức
  checkLoginStatus();

  // (MỚI) 2. Gắn sự kiện cho nút Logout
  const logoutBtn = document.getElementById('logoutButton');
  if(logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // 3. Gắn sự kiện cho nút Login (trong Modal)
  const loginSubmitBtn = document.querySelector(".btn-login-submit");
  if (loginSubmitBtn) {
    loginSubmitBtn.addEventListener("click", handleLogin);
  }

  // 4. Gắn sự kiện Enter cho ô password
  const passwordInput = document.getElementById("password");
  if (passwordInput) {
    passwordInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleLogin();
      }
    });
  }

  // 5. Reset modal khi đóng
  const loginModal = document.getElementById("loginModal");
  if(loginModal) {
    loginModal.addEventListener("hidden.bs.modal", () => {
      document.getElementById("loginForm").reset();
      const messageEl = document.getElementById("loginMessage");
      if (messageEl) {
        messageEl.textContent = "";
      }
    });
  }

  // 6. Logic Carousel (Giữ nguyên)
  const track = document.querySelector(".carousel-track");
  if (!track) return;
  const items = document.querySelectorAll(".service-card");
  if (items.length === 0) return;
  
  const originalItems = [];
  items.forEach(item => {
      const altText = item.querySelector('img') ? item.querySelector('img').alt : '';
      if (!originalItems.includes(altText)) {
          originalItems.push(altText);
      }
  });
  const totalItems = originalItems.length;
  let index = 0;
  if (totalItems === 0) return;
  
  function moveCarousel() {
    index += 3;
    const cardWidth = items[0].offsetWidth + 20;
    
    if (index >= totalItems) {
      track.style.transition = "transform 0.6s ease-in-out";
      track.style.transform = `translateX(-${cardWidth * index}px)`;
      
      setTimeout(() => {
        track.style.transition = "none";
        track.style.transform = "translateX(0)";
        index = 0;
        setTimeout(() => {
          track.style.transition = "transform 0.6s ease-in-out";
        }, 50);
      }, 600);
    } else {
      track.style.transition = "transform 0.6s ease-in-out";
      track.style.transform = `translateX(-${cardWidth * index}px)`;
    }
  }
  setInterval(moveCarousel, 2500);
});