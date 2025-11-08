document.addEventListener("DOMContentLoaded", () => {
  const roleCards = document.querySelectorAll(".role-card");
  const form = document.getElementById("register-form");
  const roleSelect = document.getElementById("role-select");
  const backBtn = document.getElementById("back-btn");
  const formTitle = document.getElementById("form-title");
  const clinicField = document.getElementById("clinic-field");
  const messageEl = document.getElementById("registerMessage"); // Vị trí báo lỗi

  // Định nghĩa API URL (trỏ đến API Gateway)
  const API_BASE_URL = "http://localhost:8000/api/auth";

  // Hàm trợ giúp hiển thị thông báo
  function showMessage(message, isError = true) {
    messageEl.innerHTML = message;
    messageEl.className = isError ? "alert alert-danger" : "alert alert-success";
  }

  // (ĐÃ SỬA) Hàm xử lý submit form
  async function handleRegisterSubmit(e) {
    e.preventDefault(); // Ngăn form tải lại trang
    showMessage("Đang xử lý...", false);

    // 1. Lấy dữ liệu từ các input (Đã cập nhật)
    const role = form.dataset.selectedRole;
    const firstName = document.getElementById("regFirstName").value.trim();
    const lastName = document.getElementById("regLastName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const confirmPassword = document.getElementById("regConfirmPassword").value;
    const phone = document.getElementById("regPhone").value.trim();

    // 2. Kiểm tra (Validate) dữ liệu
    if (!role || !firstName || !lastName || !email || !password || !phone) {
      showMessage("Vui lòng điền đầy đủ các trường bắt buộc.");
      return;
    }
    if (password.length < 6) {
      showMessage("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      showMessage("Mật khẩu và xác nhận mật khẩu không khớp.");
      return;
    }

    // 3. (FIX LỖI 422) Tạo body JSON với key là snake_case
    // Các key này phải khớp 100% với BaseModel của Pydantic
    const userData = {
      email: email,
      password: password,
      first_name: firstName,    // <-- ĐÃ SỬA
      last_name: lastName,      // <-- ĐÃ SỬA
      phone_number: phone,      // <-- ĐÃ SỬA
      role: role
    };

    // 4. Gọi API
    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData), // Gửi JSON đã sửa
      });

      const data = await response.json();

      if (response.status === 201) { // 201 Created
        // Đăng ký thành công
        showMessage(`Đăng ký thành công! Bạn sẽ được chuyển về trang chủ sau 3s...`, false);
        form.reset();
        setTimeout(() => {
          window.location.href = "index.html"; // Chuyển về trang chủ
        }, 3000);

      } else {
        // Có lỗi từ server (400, 422)
        if (data.detail && Array.isArray(data.detail)) {
          // Lỗi validation Pydantic (hiển thị chi tiết)
          const errorMsg = data.detail.map(err => `Trường '${err.loc[1]}' ${err.msg}`).join('<br>');
          showMessage(errorMsg);
        } else {
          // Lỗi chung (ví dụ: "Email đã tồn tại")
          showMessage(data.detail || "Đã có lỗi xảy ra. Vui lòng thử lại.");
        }
      }
    } catch (error) {
      // Lỗi mạng (ví dụ: API Gateway chưa chạy)
      console.error("Lỗi đăng ký:", error);
      showMessage("Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại.");
    }
  }

  // --- Logic gốc để chọn Role và nút Back ---

  roleCards.forEach((card) => {
    card.addEventListener("click", () => {
      const role = card.dataset.role;
      form.dataset.selectedRole = role; // Lưu role đã chọn vào form

      roleSelect.classList.add("d-none");
      form.classList.remove("d-none");
      
      formTitle.innerText =
        role === "DENTIST" ? "Register as Dentist / Clinic" : "Register as Customer";

      clinicField.classList.toggle("d-none", role !== "DENTIST");
    });
  });

  backBtn.addEventListener("click", () => {
    form.reset();
    form.classList.add("d-none");
    roleSelect.classList.remove("d-none");
    messageEl.innerHTML = ""; // Xóa thông báo
    form.dataset.selectedRole = ""; // Xóa role đã chọn
  });

  // Gắn hàm submit mới vào sự kiện 'submit' của form
  form.addEventListener("submit", handleRegisterSubmit);
});