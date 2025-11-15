const API_BASE_URL = "http://localhost:8000/api/auth";
// (TODO) Thêm API URL cho các service khác khi cần
//const API_DENTIST_URL = "http://localhost:8000/api/dentists"; 
// const API_APPOINTMENT_URL = "http://localhost:8000/api/appointments";
const API_DENTIST_URL = "http://127.0.0.1:8004/dentists";
const API_APPOINTMENT_URL = "http://127.0.0.1:8003/appointments";
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
        // console.log('Đã đăng nhập với tư cách Nha sĩ:', data);
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
    const profileResponse = await fetch(`${API_DENTIST_URL}/${userId}`);
    const profileData = await profileResponse.json();
  
    
    // Cập nhật UI (Sẽ hiển thị "Dr. Nguyễn Văn B")
    document.getElementById('dentistName').textContent = `Dr. ${profileData.first_name} ${profileData.last_name}`;
    document.getElementById('dentistEmail').textContent = profileData.email;
    
    // Tải view "Profile" làm mặc định
    loadContent('profile', profileData);
}
async function loadAppointmentsData(userId) {
    //
    const appointmentsResponse = await fetch(`${API_APPOINTMENT_URL}/dentist/${userId}`);
    const appointmentsData = await appointmentsResponse.json();
    //
    loadContent('appointments', appointmentsData);
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
                  <input type="text" class="form-control" value="${data.specialty || ''}">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Số năm kinh nghiệm</label>
                  <input type="number" class="form-control" value="${data.years_of_experience || 0}">
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
      if (!data || data.length === 0) {
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
      }

      // ✅ Hàm xác nhận lịch hẹn
      async function confirmAppointment(appointmentId, buttonElement) {
        
          const response = await fetch(`${API_APPOINTMENT_URL}/${appointmentId}/confirm`, {
            method: "PATCH",
          });

          // Debug để xem phản hồi thật sự
          const text = await response.text();


          // Nếu phản hồi không rỗng thì thử parse JSON
          let result = {};
          try {
            result = JSON.parse(text);
          } catch {
            console.warn("Phản hồi không phải JSON (hoặc rỗng).");
          }

          // Cập nhật giao diện
          const statusElement = buttonElement.closest(".card-body").querySelector(".status-text");
          statusElement.innerHTML = `<span class="badge bg-success">Đã xác nhận</span>`;
          buttonElement.textContent = "Đã xác nhận";
          buttonElement.disabled = true;
          buttonElement.classList.remove("btn-outline-primary");
          buttonElement.classList.add("btn-success");

          const cancelBtn = buttonElement.parentElement.querySelector(".cancel-btn");
          if (cancelBtn) cancelBtn.disabled = true;

          //console.log("Xác nhận thành công:", result);
        
      }


      // ✅ Hàm hủy lịch hẹn
      async function cancelAppointment(appointmentId, buttonElement) {
        if (!confirm("Bạn có chắc muốn hủy cuộc hẹn này không?")) return;

        try {
          const response = await fetch(`${API_APPOINTMENT_URL}/${appointmentId}/cancel`, {
            method: "PATCH",
          });

          if (!response.ok) {
            alert("Hủy lịch thất bại!");
            return;
          }

          const statusElement = buttonElement.closest(".card-body").querySelector(".status-text");
          statusElement.innerHTML = `<span class="badge bg-danger">Đã hủy</span>`;

          // Cập nhật 2 nút
          buttonElement.textContent = "Đã hủy";
          buttonElement.disabled = true;
          buttonElement.classList.remove("btn-outline-danger");
          buttonElement.classList.add("btn-danger");

          const confirmBtn = buttonElement.parentElement.querySelector(".confirm-btn");
          if (confirmBtn) confirmBtn.disabled = true;
        } catch (error) {
          console.error("Lỗi khi hủy lịch hẹn:", error);
          alert("Có lỗi xảy ra khi hủy!");
        }
      }

      // Cho phép gọi toàn cục
      window.confirmAppointment = confirmAppointment;
      window.cancelAppointment = cancelAppointment;

      // ✅ Render danh sách lịch hẹn
      let appointmentCards = data
        .map((item) => {
          const fullName = `${item.patient_first_name} ${item.patient_last_name}`;
          const date = new Date(item.appointment_datetime).toLocaleString("vi-VN");
          const isPending = item.status === "Pending";
          const isConfirmed = item.status === "confirmed" || item.status === "Confirmed";
          const isCancelled = item.status === "cancelled" || item.status === "Cancelled";

          let statusBadge = `<span class="badge bg-warning text-dark">Đang chờ</span>`;
          if (isConfirmed) statusBadge = `<span class="badge bg-success">Đã xác nhận</span>`;
          if (isCancelled) statusBadge = `<span class="badge bg-danger">Đã hủy</span>`;

          return `
            <div class="card mt-3">
              <div class="card-body">
                <h5 class="card-title">Bệnh nhân: ${fullName}</h5>
                <p class="card-text"><strong>Thời gian:</strong> ${date}</p>
                <p class="card-text status-text"><strong>Trạng thái:</strong> ${statusBadge}</p>
                
                <div class="d-flex gap-2">
                  <button 
                    class="btn btn-sm confirm-btn ${isPending ? 'btn-outline-primary' : 'btn-success'}"
                    ${!isPending ? 'disabled' : ''}
                    onclick="confirmAppointment('${item.appointment_id}', this)">
                    ${isPending ? 'Xác nhận' : 'Đã xác nhận'}
                  </button>

                  <button 
                    class="btn btn-sm cancel-btn ${isPending ? 'btn-outline-danger' : 'btn-danger'}"
                    ${!isPending ? 'disabled' : ''}
                    onclick="cancelAppointment('${item.appointment_id}', this)">
                    ${isPending ? 'Hủy' : 'Đã hủy'}
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('');

      contentArea.innerHTML = `
        <h2 class="h3">Quản lý lịch hẹn</h2>
        <p class="text-muted">Xem các lịch hẹn đang chờ xác nhận hoặc đã đặt.</p>
        <div class="card mt-4">
          <div class="card-body p-4">
            ${appointmentCards}
          </div>
        </div>
      `;
      break;

    case 'schedule':

      contentArea.innerHTML = `
        <h2 class="h3">Lịch làm việc</h2>
        <p class="text-muted">Xem lịch hẹn theo ngày và giờ.</p>

        <div class="card mt-4">
          <div class="card-body text-center p-4">
            <div class="spinner-border text-primary"></div>
            <p class="mt-3">Đang tải lịch biểu...</p>
          </div>
        </div>
      `;

      loadSchedule(data);  // data = dentistId
      break;


    case 'clinic':
      contentArea.innerHTML = `
        <h2 class="h3">Phòng khám của tôi</h2>
        <p class="text-muted">Quản lý thông tin phòng khám liên kết.</p>
        <div id="clinicList" class="mt-4"></div>
      `;

      loadClinics(data);
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
      initSettingsForm();
      break;
      
    default:
      // SỬA LỖI 1: Bỏ dấu `\` bị thừa
      contentArea.innerHTML = `<p>Trang không tìm thấy.</p>`;
  }
}

//--------------------------------------------------------------------------------------------------------------//
async function loadSchedule(dentistId) {
  if (!dentistId) {
    console.error("DentistId không hợp lệ khi gọi loadSchedule()");
    contentArea.innerHTML = `
      <h2 class="h3">Lịch làm việc</h2>
      <p class="text-danger">Không tìm thấy ID nha sĩ.</p>
    `;
    return;
  }

  const start = "2025-01-01";
  const end = "2025-12-31";

  try {
    const response = await fetch(
      `${API_APPOINTMENT_URL}/schedule/${dentistId}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
    );

    if (!response.ok) {
      console.error("Schedule API error:", response.status);
      contentArea.innerHTML = `
        <h2 class="h3">Lịch làm việc</h2>
        <p class="text-danger">Không thể tải lịch biểu (mã ${response.status}).</p>
      `;
      return;
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      console.error("Schedule API trả về không phải mảng:", data);
      contentArea.innerHTML = `
        <h2 class="h3">Lịch làm việc</h2>
        <p class="text-danger">Dữ liệu lịch không hợp lệ.</p>
      `;
      return;
    }

    const grouped = groupByDate(data);
    renderSchedule(grouped);

  } catch (err) {
    console.error("Lỗi loadSchedule:", err);
    contentArea.innerHTML = `
      <h2 class="h3">Lịch làm việc</h2>
      <p class="text-danger">Không thể kết nối server.</p>
    `;
  }
}


//--------------------------------------------------------------------------------------------------------------//
async function loadClinics(dentist_id) {
     // hoặc lấy từ token decode
    const clinicList = document.getElementById("clinicList");

    if (!dentist_id) {
        clinicList.innerHTML = "<p class='text-danger'>Không tìm thấy dentist_id</p>";
        return;
    }

    try {
        const res = await fetch( `${API_DENTIST_URL}/${dentist_id}/clinics/`);
        const data = await res.json();

        if (!data.length) {
            clinicList.innerHTML = "<p class='text-muted'>Bạn chưa liên kết phòng khám nào.</p>";
            return;
        }
        console.log(dentist_id);
        clinicList.innerHTML = data.map(clinic => `
            <div class="card mb-3">
                <div class="card-body p-4">
                    <h5>${clinic.clinic_name}</h5>
                    <p>${clinic.address}</p>
                    <button class="btn btn-outline-primary" onclick="openClinicServices(${clinic.clinic_id},${dentist_id})">
                        Quản lý dịch vụ
                    </button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        clinicList.innerHTML = "<p class='text-danger'>Không thể tải dữ liệu phòng khám.</p>";
        console.error(error);
    }
}


async function openClinicServices(clinic_id,dentist_id) {
    console.log(dentist_id);
    
    const url = `${API_DENTIST_URL}/${dentist_id}/clinics/${clinic_id}/services/`;

    contentArea.innerHTML = `
        <h2 class="h3">Dịch vụ tại phòng khám</h2>
        <button class="btn btn-secondary mb-3" onclick="loadContent('clinic')">&larr; Quay lại</button>

        <div class="text-end mb-3">
            <button class="btn btn-primary" onclick="showAddServiceForm(${clinic_id})">+ Thêm dịch vụ</button>
        </div>

        <div id="serviceList">Đang tải...</div>
    `;
    
    try {
        const res = await fetch(url);
        
        const services = await res.json();
        
        //console.log("SERVICES RECEIVED:", services);
        //services.forEach(s => console.log("SERVICE ITEM:", s));
        window.latestServices = services;
        const list = document.getElementById("serviceList");

        if (!services.length) {
            list.innerHTML = "<p class='text-muted'>Chưa có dịch vụ nào.</p>";
            return;
        }
        console.log(services);
        list.innerHTML = services.map(s => `
            <div class="card mb-2">
                <div class="card-body d-flex justify-content-between">
                    <div>
                        <h5>${s.service_name}</h5>
                        <p>${s.description || "Không mô tả"}</p>
                        <small>Giá: ${s.min_price} - ${s.max_price} VND</small><br>
                        <small>Thời gian dự kiến: ${s.expected_duration_minutes} phút</small>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-outline-warning" onclick="editService(${clinic_id}, ${s.service_id})">Sửa</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteService(${clinic_id}, ${s.service_id})">Xóa</button>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error(err);
        document.getElementById("serviceList").innerHTML =
            "<p class='text-danger'>Không thể tải danh sách dịch vụ.</p>";
    }
    
    
}


function showAddServiceForm(clinic_id) {
    contentArea.innerHTML = `
        <h2 class="h3">Thêm dịch vụ mới</h2>
        <button class="btn btn-secondary mb-3" onclick="loadContent('clinic', currentDentist.user_id)">&larr; Quay lại</button>

        <form id="addServiceForm">
            <div class="mb-3">
                <label class="form-label">Tên dịch vụ</label>
                <input type="text" class="form-control" id="sv_name" required>
            </div>

            <div class="mb-3">
                <label class="form-label">Mô tả</label>
                <textarea class="form-control" id="sv_desc"></textarea>
            </div>

            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Giá thấp nhất</label>
                    <input type="number" class="form-control" id="sv_min" required>
                </div>

                <div class="col-md-6 mb-3">
                    <label class="form-label">Giá cao nhất</label>
                    <input type="number" class="form-control" id="sv_max" required>
                </div>
            </div>

            <div class="mb-3">
                <label class="form-label">Thời lượng dự kiến (phút)</label>
                <input type="number" class="form-control" id="sv_duration" required>
            </div>

            <button class="btn btn-primary" onclick="saveNewService(${clinic_id}); return false;">Lưu</button>
        </form>
    `;
}

async function saveNewService(clinic_id) {
    const body = {
        name: document.getElementById("sv_name").value,
        description: document.getElementById("sv_desc").value,
        min_price: +document.getElementById("sv_min").value,
        max_price: +document.getElementById("sv_max").value,
        expected_duration_minutes: +document.getElementById("sv_duration").value,
    };

    const dentist_id = currentDentist.user_id;

    try {
        const res = await fetch(`${API_DENTIST_URL}/${dentist_id}/clinics/${clinic_id}/services/`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(body)
        });

        const result = await res.json();

        alert("Đã thêm dịch vụ thành công!");
        openClinicServices(clinic_id, dentist_id);

    } catch(err) {
        alert("Lỗi khi thêm dịch vụ!");
        console.error(err);
    }
}

function editService(clinic_id, service_id) {

    const service = window.latestServices.find(
        s => Number(s.service_id) === Number(service_id)
    );

    if (!service) {
        console.error("Không tìm thấy service:", service_id);
        console.log("Danh sách services:", window.latestServices);
        alert("Không thể sửa dịch vụ này!");
        return;
    }

    contentArea.innerHTML = `
        <h2 class="h3">Sửa dịch vụ</h2>
        <button class="btn btn-secondary mb-3" onclick="openClinicServices(${clinic_id}, currentDentist.user_id)">&larr; Quay lại</button>

        <form id="editServiceForm">
            <div class="mb-3">
                <label class="form-label">Tên dịch vụ</label>
                <input type="text" class="form-control" id="sv_name" value="${service.service_name}">
            </div>

            <div class="mb-3">
                <label class="form-label">Mô tả</label>
                <textarea class="form-control" id="sv_desc">${service.description || ""}</textarea>
            </div>

            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Giá thấp nhất</label>
                    <input type="number" class="form-control" id="sv_min" value="${service.min_price}">
                </div>

                <div class="col-md-6 mb-3">
                    <label class="form-label">Giá cao nhất</label>
                    <input type="number" class="form-control" id="sv_max" value="${service.max_price}">
                </div>
            </div>

            <div class="mb-3">
                <label class="form-label">Thời lượng dự kiến (phút)</label>
                <input type="number" class="form-control" id="sv_duration" value="${service.expected_duration_minutes}">
            </div>

            <button class="btn btn-primary" onclick="saveEditService(${clinic_id}, ${service_id}); return false;">Cập nhật</button>
        </form>
    `;
}




async function saveEditService(clinic_id, service_id) {
    const dentist_id = currentDentist.user_id;

    const body = {
        name: document.getElementById("sv_name").value,
        description: document.getElementById("sv_desc").value,
        min_price: +document.getElementById("sv_min").value,
        max_price: +document.getElementById("sv_max").value,
        expected_duration_minutes: +document.getElementById("sv_duration").value,
    };

    try {
        const res = await fetch(`${API_DENTIST_URL}/${dentist_id}/clinics/${clinic_id}/services/${service_id}`, {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(body)
        });

        alert("Cập nhật thành công!");
        openClinicServices(clinic_id, dentist_id);

    } catch (err) {
        alert("Lỗi khi cập nhật dịch vụ!");
        console.error(err);
    }
}
async function deleteService(clinic_id, service_id) {
    if (!confirm("Bạn chắc chắn muốn xóa dịch vụ này?")) return;

    const dentist_id = currentDentist.user_id;

    try {
        await fetch(`${API_DENTIST_URL}/${dentist_id}/clinics/${clinic_id}/services/${service_id}`, {
            method: "DELETE"
        });

        alert("Đã xóa thành công!");
        openClinicServices(clinic_id, dentist_id);

    } catch(err) {
        alert("Lỗi khi xóa dịch vụ!");
        console.error(err);
    }
}

//--------------------------------------------------------------------------------------------------------------//
function groupByDate(appointments) {
  const result = {};

  appointments.forEach(a => {
    const date = a.appointment_datetime.split("T")[0];
    const time = new Date(a.appointment_datetime).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit"
    });

    if (!result[date]) result[date] = [];

    result[date].push({
      id: a.appointment_id,
      time,
      patient: `${a.patient_first_name} ${a.patient_last_name}`,
      dentist: `${a.dentist_first_name} ${a.dentist_last_name}`,
      status: a.status
    });
  });

  return result;
}


//--------------------------------------------------------------------------------------------------------------//
const contentArea = document.getElementById('dashboardContentArea');
function renderSchedule(groupedData) {
  let html = `
    <h2 class="h3">Lịch làm việc</h2>
    <p class="text-muted">Xem tất cả lịch hẹn theo ngày.</p>
  `;

  if (Object.keys(groupedData).length === 0) {
    contentArea.innerHTML = `
      <h2 class="h3">Lịch làm việc</h2>
      <p class="text-muted">Không có lịch hẹn nào.</p>
    `;
    return;
  }

  for (let date in groupedData) {
    html += `
      <div class="card mt-4">
        <div class="card-body p-4">

          <h5 class="mb-3">${new Date(date).toLocaleDateString("vi-VN")}</h5>

          <table class="table table-bordered">
            <thead>
              <tr>
                <th>Giờ</th>
                <th>Bệnh nhân</th>
                <th>Bác sĩ</th>
                <th>Trạng thái</th>
              </tr>
              
            </thead>
            
            <tbody>
    `;

    groupedData[date].forEach(a => {
      html += `
        <tr onclick="openAppointmentDetail(${a.id})" style="cursor:pointer">
          <td>${a.time}</td>
          <td>${a.patient}</td>
          <td>${a.dentist}</td>
          <td>
            <span class="badge ${
              a.status === 'Confirmed' ? 'bg-success' :
              a.status === 'Cancelled' ? 'bg-danger' :
              a.status === 'Pending' ? 'bg-warning ' :
              'bg-warning text-dark'
            }">${a.status}</span>
          </td>
          
        </tr>
        <tr onclick="openAppointmentDetail(${a.id})" style="cursor:pointer">
          <Button colspan="4">Xem chi tiết cuộc hẹn...</Button>
          
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>

        </div>
      </div>
    `;
  }

  contentArea.innerHTML = html;
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
//--------------------------------------------------------------------------------------------------------------//

function initSettingsForm() {
  const form = document.getElementById("passwordForm");
  if (!form) return;

  form.addEventListener("submit", async function(e) {
    e.preventDefault();

    const inputs = form.querySelectorAll("input");
    const oldPass = inputs[0].value;
    const newPass = inputs[1].value;
    const confirmPass = inputs[2].value;

    if (newPass !== confirmPass) {
      alert("Mật khẩu mới không khớp!");
      return;
    }

    if (!currentDentist || !currentDentist.user_id) {
      alert("Không tìm thấy thông tin nha sĩ. Vui lòng đăng nhập lại.");
      return;
    }

    const dentistId = currentDentist.user_id;

    try {
      const res = await fetch(`${API_DENTIST_URL}/${dentistId}/change-password`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          old_password: oldPass,
          new_password: newPass
        })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Đổi mật khẩu thất bại!");
        return;
      }

      alert("Đổi mật khẩu thành công!");
      form.reset();
      handleLogout();

    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối server!");
    }
  });
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
      // const profileData = {
      //   first_name: currentDentist.first_name || "Nguyễn", // Sửa mock data
      //   last_name: currentDentist.last_name || "Văn B",
      //   email: currentDentist.email || "...",
      //   phone_number: currentDentist.phone_number || "...",
      //   specialization: "Orthodontics",
      //   years_of_exp: 10,
      //   bio: "Chuyên gia niềng răng với 10 năm kinh nghiệm."
      // };

      if(view === 'appointments') {
        loadAppointmentsData(currentDentist.user_id);
        return;
      }else if(view === 'profile') {
        loadDashboardData(currentDentist.user_id);
        return;
      }else if(view === 'schedule') {
        loadContent('schedule', currentDentist.user_id);
        return;
      }else if(view === 'clinic') { 
        loadContent('clinic', currentDentist.user_id);
        return;
      }else if(view === 'settings') {
        loadContent('settings', currentDentist.user_id);
        return;
      }
      loadContent(view, profileData);
    });
  });
});

