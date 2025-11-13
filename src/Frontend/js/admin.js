// File: /src/Frontend/js/admin.js
const API_AUTH_URL = "http://localhost:8000/api/auth";
const API_ADMIN_URL = "http://localhost:8000/api/admin";

let currentAdmin = null;
let adminEditModal = null; // Đối tượng Bootstrap Modal

/**
 * HÀM 1: BẢO VỆ TRANG ADMIN
 */
async function checkAdminAuth() {
  try {
    const response = await fetch(`${API_AUTH_URL}/me`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.role !== 'ADMIN') {
        alert('Bạn không có quyền truy cập trang này.');
        window.location.href = 'index.html';
      } else {
        currentAdmin = data;
        // Tải nội dung Dashboard (sẽ gọi API /dashboard-stats)
        loadContent('dashboard'); 
      }
    } else {
      window.location.href = 'index.html';
    }
  } catch (error) {
    console.error('Lỗi xác thực:', error);
    window.location.href = 'index.html';
  }
}

/**
 * HÀM 2: ĐĂNG XUẤT
 */
async function handleLogout() {
  try {
    await fetch(`${API_AUTH_URL}/logout`, { method: 'POST' });
  } catch (error) {
    console.error('Lỗi khi logout:', error);
  } finally {
    window.location.href = 'index.html';
  }
}

/**
 * HÀM 3: TẢI NỘI DUNG CHÍNH (ĐÃ SỬA LỖI)
 */
async function loadContent(viewName) {
  const contentArea = document.querySelector('.admin-content .container-fluid');
  if (!contentArea) return;

  contentArea.innerHTML = `<div class="d-flex justify-content-center align-items-center" style="height: 50vh;"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>`;

  try {
    let response, data, url;

    // (FIX) Logic fetch ĐƯỢC ĐẶT BÊN TRONG switch
    // để đảm bảo gọi đúng URL cho đúng viewName
    switch (viewName) {
      case 'dashboard':
        url = `${API_ADMIN_URL}/dashboard-stats`; // API thống kê
        response = await fetch(url);
        if (!response.ok) throw new Error(await response.json().then(d => d.detail));
        data = await response.json();
        renderDashboard(contentArea, data); 
        break;
      
      case 'users':
        url = `${API_ADMIN_URL}/users`;
        response = await fetch(url);
        if (!response.ok) throw new Error(await response.json().then(d => d.detail));
        data = await response.json();
        renderUsersTable(contentArea, data);
        break;

      case 'clinics':
        url = `${API_ADMIN_URL}/clinics`;
        response = await fetch(url);
        if (!response.ok) throw new Error(await response.json().then(d => d.detail));
        data = await response.json();
        renderClinicsTable(contentArea, data);
        break;

      case 'dentists':
        url = `${API_ADMIN_URL}/dentists`;
        response = await fetch(url);
        if (!response.ok) throw new Error(await response.json().then(d => d.detail));
        data = await response.json();
        renderDentistsTable(contentArea, data);
        break;

      case 'appointments':
        url = `${API_ADMIN_URL}/appointments`;
        response = await fetch(url);
        if (!response.ok) throw new Error(await response.json().then(d => d.detail));
        data = await response.json();
        renderAppointmentsTable(contentArea, data);
        break;

      case 'reports/customer': // <-- Khớp với mapping
        url = `${API_ADMIN_URL}/reports/customer`;
        response = await fetch(url);
        if (!response.ok) throw new Error(await response.json().then(d => d.detail));
        data = await response.json();
        renderReportsTable(contentArea, data);
        break;
      
      case 'verification-queue':
        url = `${API_ADMIN_URL}/verification-queue`; // API danh sách chờ
        response = await fetch(url);
        if (!response.ok) throw new Error(await response.json().then(d => d.detail));
        data = await response.json();
        renderVerificationQueue(contentArea, data);
        break;

      default:
        contentArea.innerHTML = `<h1 class="h2">Trang không tìm thấy</h1>`;
    }
  } catch (error) {
    console.error(`Lỗi khi tải ${viewName}:`, error);
    contentArea.innerHTML = `<div class="alert alert-danger">Không thể tải dữ liệu. Lỗi: ${error.message}</div>`;
  }
}

/**
 * HÀM 4: CÁC HÀM RENDER HTML
 */

// 4.1. Render Dashboard (Cập nhật để hiển thị stats)
function renderDashboard(area, stats) {
  area.innerHTML = `
    <h1 class="h2">Dashboard</h1>
    <p class="text-muted">Welcome to the admin control panel, <span id="adminEmail" class="fw-bold">${currentAdmin.user_id}</span>.</p>
    
    <div class="row g-4 mt-3">
        <div class="col-md-3">
            <div class="stat-card text-bg-primary">
                <i class="bi bi-people-fill"></i>
                <div>
                    <h5>Total Users</h5>
                    <p>${stats.total_users || 0}</p> 
                </div>
            </div>
        </div>
         <div class="col-md-3">
            <div class="stat-card text-bg-success">
                <i class="bi bi-person-badge"></i> 
                <div>
                    <h5>Total Dentists</h5>
                    <p>${stats.total_dentists || 0}</p>
                </div>
            </div>
        </div>
         <div class="col-md-3">
            <div class="stat-card text-bg-warning">
                <i class="bi bi-calendar-check"></i>
                <div>
                    <h5>Pending Bookings</h5>
                    <p>${stats.pending_bookings || 0}</p>
                </div>
            </div>
        </div>
         <div class="col-md-3">
            <div class="stat-card text-bg-danger">
                <i class="bi bi-shield-check"></i> 
                <div>
                    <h5>Pending Verifications</h5>
                    <p>${stats.pending_verifications || 0}</p>
                </div>
            </div>
        </div>
    </div> 

    <h2 class="h4 mt-5">Quick Actions</h2>
    <div class="d-flex gap-3">
        <button class="btn btn-lg btn-outline-primary" onclick="loadContent('users')">Manage Users</button>
        <button class="btn btn-lg btn-outline-danger" onclick="loadContent('verification-queue')">View Verification Queue</button>
    </div>
  `;
}

// 4.2. Render Bảng Users (Đã sửa lỗi 'disabled')
function renderUsersTable(area, users) {
  area.innerHTML = `
    <h1 class="h2">Manage Users</h1>
    <div class="table-responsive bg-white rounded shadow-sm mt-4">
      <table class="table table-hover align-middle">
        <thead class="table-light">
          <tr><th>User ID</th><th>Name</th><th>Email / Phone</th><th>Role</th><th>Action</th></tr>
        </thead>
        <tbody>
          ${(users || []).map(user => `
            <tr id="user-row-${user.user_id}">
              <td><small>${user.user_id}</small></td>
              <td>${user.first_name || ''} ${user.last_name || ''}</td>
              <td>
                ${user.email}<br>
                <small class="text-muted">${user.phone_number || ''}</small>
              </td>
              <td>
                <span class="badge ${
                  user.role === 'DENTIST' ? 'bg-success' : (user.role === 'ADMIN' ? 'bg-danger' : 'bg-primary')
                }">${user.role}</span>
              </td>
              <td>
                <button 
                  class="btn btn-sm btn-outline-primary btn-edit-user" 
                  data-id="${user.user_id}" 
                  data-bs-toggle="modal" 
                  data-bs-target="#adminEditModal"
                >
                  Edit
                </button>
                <button 
                  class="btn btn-sm btn-outline-danger btn-delete-user" 
                  data-id="${user.user_id}"
                  ${user.role === 'ADMIN' ? 'disabled' : ''}
                >
                  Delete
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// 4.3. Render Bảng Clinics
function renderClinicsTable(area, clinics) {
  area.innerHTML = `
    <h1 class="h2">Manage Clinics</h1>
    <div class="table-responsive bg-white rounded shadow-sm mt-4">
      <table class="table table-hover align-middle">
        <thead class="table-light">
          <tr><th>Clinic Name</th><th>Address</th><th>Contact</th><th>Status</th><th>Action</th></tr>
        </thead>
        <tbody>
          ${(clinics || []).map(clinic => `
            <tr>
              <td><b>${clinic.name}</b><br><small class="text-muted">${clinic.clinic_id}</small></td>
              <td>${clinic.address}</td>
              <td>${clinic.email}<br><small>${clinic.phone_number}</small></td>
              <td>
                ${clinic.is_verified 
                  ? '<span class="badge bg-success">Verified</span>' 
                  : '<span class="badge bg-warning">Pending</span>'}
              </td>
              <td>
                ${!clinic.is_verified 
                  ? `<button class="btn btn-sm btn-success btn-approve" data-type="clinic" data-id="${clinic.clinic_id}">Approve</button>` 
                  : ''}
                <button class="btn btn-sm btn-outline-danger btn-delete-clinic" data-id="${clinic.clinic_id}">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// 4.4. Render Bảng Dentists
function renderDentistsTable(area, dentists) {
   area.innerHTML = `
    <h1 class="h2">Manage Dentists</h1>
    <div class="table-responsive bg-white rounded shadow-sm mt-4">
      <table class="table table-hover align-middle">
        <thead class="table-light">
          <tr><th>Dentist Name</th><th>Specialization</th><th>Email / Phone</th><th>Status</th><th>Action</th></tr>
        </thead>
        <tbody>
          ${(dentists || []).map(dentist => `
            <tr>
              <td><b>${dentist.first_name} ${dentist.last_name}</b><br><small class="text-muted">${dentist.user_id}</small></td>
              <td>${dentist.specialization || 'N/A'}</td>
              <td>${dentist.email}<br><small>${dentist.phone_number}</small></td>
              <td>
                ${dentist.is_verified 
                  ? '<span class="badge bg-success">Verified</span>' 
                  : '<span class="badge bg-warning">Pending</span>'}
              </td>
              <td>
                <button 
                  class="btn btn-sm btn-outline-primary btn-edit-dentist" 
                  data-id="${dentist.user_id}" 
                  data-bs-toggle="modal" 
                  data-bs-target="#adminEditModal"
                >
                  Edit
                </button>
                ${!dentist.is_verified 
                  ? `<button class="btn btn-sm btn-success btn-approve" data-type="dentist" data-id="${dentist.user_id}">Approve</button>` 
                  : ''}
                <button class="btn btn-sm btn-outline-danger btn-delete-user" data-id="${dentist.user_id}">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// 4.5. Render Bảng Appointments
function renderAppointmentsTable(area, appointments) {
  area.innerHTML = `
    <h1 class="h2">Manage Appointments</h1>
    <div class="table-responsive bg-white rounded shadow-sm mt-4">
      <table class="table table-hover align-middle">
        <thead class="table-light">
          <tr><th>Date & Time</th><th>Customer</th><th>Dentist</th><th>Status</th><th>Action</th></tr>
        </thead>
        <tbody>
          ${(appointments || []).map(appt => `
            <tr>
              <td><b>${new Date(appt.appointment_datetime).toLocaleString('vi-VN')}</b></td>
              <td>${appt.cust_first || 'N/A'} ${appt.cust_last || ''}</td>
              <td>${appt.dent_first || 'N/A'} ${appt.dent_last || ''}</td>
              <td><span class="badge bg-info">${appt.status}</span></td>
              <td>
                <button class="btn btn-sm btn-outline-danger btn-delete-appointment" data-id="${appt.appointment_id}">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// 4.6. Render Bảng Reports
function renderReportsTable(area, reports) {
  area.innerHTML = `
    <h1 class="h2">View Reports</h1>
    <div class="table-responsive bg-white rounded shadow-sm mt-4">
      <table class="table table-hover align-middle">
        <thead class="table-light">
          <tr><th>Date</th><th>Reporter ID</th><th>Reported ID</th><th>Reason</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${(reports || []).map(report => `
            <tr>
              <td>${new Date(report.created_at).toLocaleString('vi-VN')}</td>
              <td><small>${report.reporter_id}</small></td>
              <td><small>${report.reported_user_id || report.reported_clinic_id}</small></td>
              <td>${report.reason}</td>
              <td><span class="badge bg-warning">${report.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// 4.7. Render Bảng Verification Queue
function renderVerificationQueue(area, data) {
  const { pending_dentists = [], pending_clinics = [] } = data || {};
  area.innerHTML = `
    <h1 class="h2">Verification Queue</h1>
    
    <h3 class="h5 mt-4">Pending Dentists (${(pending_dentists || []).length})</h3>
    <div class="table-responsive bg-white rounded shadow-sm">
      <table class="table table-hover">
        <thead class="table-light">
          <tr><th>Name</th><th>Email</th><th>License</th><th>Action</th></tr>
        </thead>
        <tbody>
          ${(pending_dentists || []).length > 0 ? pending_dentists.map(d => `
            <tr>
              <td>${d.first_name} ${d.last_name}</td>
              <td>${d.email}</td>
              <td>${d.license_num || 'N/A'}</td>
              <td>
                <button class="btn btn-sm btn-success btn-approve" data-type="dentist" data-id="${d.user_id}">Approve</button>
                <button class="btn btn-sm btn-outline-danger btn-delete-user" data-id="${d.user_id}">Reject (Delete)</button>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="4" class="text-center p-3">No pending dentists.</td></tr>'}
        </tbody>
      </table>
    </div>

    <h3 class="h5 mt-5">Pending Clinics (${(pending_clinics || []).length})</h3>
    <div class="table-responsive bg-white rounded shadow-sm">
      <table class="table table-hover">
        <thead class="table-light">
          <tr><th>Name</th><th>Address</th><th>Email</th><th>Action</th></tr>
        </thead>
        <tbody>
          ${(pending_clinics || []).length > 0 ? pending_clinics.map(c => `
            <tr>
              <td>${c.name}</td>
              <td>${c.address}</td>
              <td>${c.email}</td>
              <td>
                <button class="btn btn-sm btn-success btn-approve" data-type="clinic" data-id="${c.clinic_id}">Approve</button>
                <button class="btn btn-sm btn-outline-danger btn-delete-clinic" data-id="${c.clinic_id}">Reject (Delete)</button>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="4" class="text-center p-3">No pending clinics.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

// 4.8. Render Form Sửa User (đầy đủ)
function renderEditUserModal(area, user) {
  const dob = user.date_of_birth ? user.date_of_birth.split('T')[0] : '';
  area.innerHTML = `
    <form id="editUserForm" data-id="${user.user_id}">
      <div class="mb-3">
        <label class="form-label">User ID (Không thể sửa)</label>
        <input type="text" class="form-control" value="${user.user_id}" disabled>
      </div>
      <div class="row">
        <div class="col-md-6 mb-3">
          <label for="editEmail" class="form-label">Email</label>
          <input type="email" class="form-control" id="editEmail" value="${user.email || ''}" required>
        </div>
        <div class="col-md-6 mb-3">
          <label for="editPhone" class="form-label">Phone Number</label>
          <input type="tel" class="form-control" id="editPhone" value="${user.phone_number || ''}">
        </div>
      </div>
      <hr><h5 class="h6">Personal Info</h5>
      <div class="row">
        <div class="col-md-4 mb-3">
          <label for="editFirstName" class="form-label">First Name</label>
          <input type="text" class="form-control" id="editFirstName" value="${user.first_name || ''}">
        </div>
        <div class="col-md-4 mb-3">
          <label for="editMiddleName" class="form-label">Middle Name</label>
          <input type="text" class="form-control" id="editMiddleName" value="${user.middle_name || ''}">
        </div>
        <div class="col-md-4 mb-3">
          <label for="editLastName" class="form-label">Last Name</label>
          <input type="text" class="form-control" id="editLastName" value="${user.last_name || ''}">
        </div>
      </div>
      <div class="row">
        <div class="col-md-6 mb-3">
          <label for="editGender" class="form-label">Gender</label>
          <select id="editGender" class="form-select">
            <option value="" ${!user.gender ? 'selected' : ''}>-- Select --</option>
            <option value="Male" ${user.gender === 'Male' ? 'selected' : ''}>Male</option>
            <option value="Female" ${user.gender === 'Female' ? 'selected' : ''}>Female</option>
            <option value="Other" ${user.gender === 'Other' ? 'selected' : ''}>Other</option>
          </select>
        </div>
        <div class="col-md-6 mb-3">
          <label for="editDob" class="form-label">Date of Birth</label>
          <input type="date" class="form-control" id="editDob" value="${dob}">
        </div>
      </div>
      <div class="mb-3">
        <label for="editAddress" class="form-label">Address</label>
        <textarea class="form-control" id="editAddress" rows="2">${user.address || ''}</textarea>
      </div>
      <hr><h5 class="h6">Account Settings</h5>
      <div class="row">
        <div class="col-md-6 mb-3">
          <label for="editRole" class="form-label">Role</label>
          <select id="editRole" class="form-select">
            <option value="CUSTOMER" ${user.role === 'CUSTOMER' ? 'selected' : ''}>CUSTOMER</option>
            <option value="DENTIST" ${user.role === 'DENTIST' ? 'selected' : ''}>DENTIST</option>
            <option value="ADMIN" ${user.role === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
          </select>
        </div>
        <div class="col-md-6 mb-3">
          <label for="editNewPassword" class="form-label">New Password</label>
          <input type="password" class="form-control" id="editNewPassword" placeholder="Để trống để giữ nguyên mật khẩu">
          <small class="text-muted">Nhập mật khẩu mới (ít nhất 6 ký tự) nếu muốn thay đổi.</small>
        </div>
      </div>
      ${user.role === 'CUSTOMER' && user.details ? `
        <div class="mb-3 form-check">
          <input type="checkbox" class="form-check-input" id="editBanStatus" ${user.details.ban_status ? 'checked' : ''}>
          <label class="form-check-label" for="editBanStatus">Ban this user (Cấm người dùng này)</label>
        </div>
      ` : ''}
    </form>
  `;
}

// 4.9. Render Form Sửa Dentist (cho tab 'Manage Dentists')
function renderEditDentistModal(area, dentist) {
  const details = dentist.details || {};
  area.innerHTML = `
    <form id="editDentistForm" data-id="${dentist.user_id}">
      <div class="mb-3"><label class="form-label">User ID (Không thể sửa)</label><input type="text" class="form-control" value="${dentist.user_id}" disabled></div>
      <div class="mb-3"><label class="form-label">Email (Không thể sửa)</label><input type="email" class="form-control" value="${dentist.email}" disabled></div>
      <hr>
      <div class="row">
        <div class="col-md-6 mb-3"><label for="editFirstName" class="form-label">First Name</label><input type="text" class="form-control" id="editFirstName" value="${dentist.first_name || ''}" required></div>
        <div class="col-md-6 mb-3"><label for="editLastName" class="form-label">Last Name</label><input type="text" class="form-control" id="editLastName" value="${dentist.last_name || ''}" required></div>
      </div>
      <div class="mb-3"><label for="editPhone" class="form-label">Phone Number</label><input type="tel" class="form-control" id="editPhone" value="${dentist.phone_number || ''}" required></div>
      <div class="mb-3"><label for="editSpecialization" class="form-label">Specialization</label><input type="text" class="form-control" id="editSpecialization" value="${details.specialization || ''}"></div>
      <div class="mb-3"><label for="editYearsExp" class="form-label">Years of Experience</label><input type="number" class="form-control" id="editYearsExp" value="${details.years_of_exp || 0}"></div>
      <div class="mb-3"><label for="editBio" class="form-label">Bio</label><textarea class="form-control" id="editBio" rows="3">${details.bio || ''}</textarea></div>
      <div class="mb-3 form-check"><input type="checkbox" class="form-check-input" id="editVerified" ${details.is_verified ? 'checked' : ''}><label class="form-check-label" for="editVerified">Is Verified (Đã xác thực)</label></div>
    </form>
  `;
}


/**
 * HÀM 5: XỬ LÝ CÁC HÀNH ĐỘNG (CLICK NÚT)
 */

// 5.1. Xử lý khi click nút Edit
async function handleEditUserClick(id) {
  const modalBody = document.getElementById('adminEditModalBody');
  const modalTitle = document.getElementById('adminEditModalLabel');
  modalBody.innerHTML = '<div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div>';
  
  try {
    const response = await fetch(`${API_ADMIN_URL}/users/${id}`);
    if (!response.ok) throw new Error('Failed to fetch user details');
    const user = await response.json();

    const activeView = document.querySelector('.admin-sidebar .nav-link.active').dataset.view;

    if(activeView === 'dentists' && user.role === 'DENTIST') {
       modalTitle.textContent = `Edit Dentist: ${id}`;
       renderEditDentistModal(modalBody, user);
    } else {
       modalTitle.textContent = `Edit User: ${id}`;
       renderEditUserModal(modalBody, user);
    }
    
  } catch (error) {
    modalBody.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
  }
}

// 5.2. Xử lý khi nhấn "Save changes"
async function handleSaveChanges() {
  const editUserForm = document.getElementById('editUserForm');
  const editDentistForm = document.getElementById('editDentistForm');
  
  let id, body, response, endpoint;
  
  try {
    if (editUserForm) {
      // --- Đang SỬA USER (CUSTOMER/ADMIN) bằng form đầy đủ ---
      id = editUserForm.dataset.id;
      endpoint = `${API_ADMIN_URL}/users/${id}`;
      const newPassword = document.getElementById('editNewPassword').value;
      
      body = {
        email: document.getElementById('editEmail').value,
        phone_number: document.getElementById('editPhone').value || null,
        first_name: document.getElementById('editFirstName').value || null,
        middle_name: document.getElementById('editMiddleName').value || null,
        last_name: document.getElementById('editLastName').value || null,
        gender: document.getElementById('editGender').value || null,
        date_of_birth: document.getElementById('editDob').value || null,
        address: document.getElementById('editAddress').value || null,
        role: document.getElementById('editRole').value,
        new_password: newPassword ? newPassword : null
      };
      
      response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(await response.json().then(d => d.detail));

      const banCheckbox = document.getElementById('editBanStatus');
      if (banCheckbox) {
        const wantsToBan = banCheckbox.checked;
        const banEndpoint = `${API_ADMIN_URL}/users/${wantsToBan ? 'ban' : 'unban'}/${id}`;
        response = await fetch(banEndpoint, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to update ban status');
      }

    } else if (editDentistForm) {
      // --- Đang SỬA DENTIST (Từ tab 'Manage Dentists') ---
      id = editDentistForm.dataset.id;
      endpoint = `${API_ADMIN_URL}/dentists/${id}`; 
      
      body = {
        first_name: document.getElementById('editFirstName').value,
        last_name: document.getElementById('editLastName').value,
        phone_number: document.getElementById('editPhone').value,
        specialization: document.getElementById('editSpecialization').value,
        years_of_exp: parseInt(document.getElementById('editYearsExp').value, 10),
        bio: document.getElementById('editBio').value,
        is_verified: document.getElementById('editVerified').checked
      };

      response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(await response.json().then(d => d.detail));
    }
    
    alert('Cập nhật thành công!');
    adminEditModal.hide(); 
    loadContent(document.querySelector('.admin-sidebar .nav-link.active').dataset.view);

  } catch (error) {
    console.error('Lỗi khi lưu thay đổi:', error);
    alert(`Lỗi: ${error.message}`);
  }
}


// 5.3. Hàm xử lý action chính (dùng event delegation)
async function handleAdminAction(e) {
  const target = e.target.closest('button'); // (Sửa) Lấy nút gần nhất
  if (!target) return; // Nếu click không phải nút, bỏ qua

  let id, type, response;

  try {
    if (target.classList.contains('btn-approve')) {
      id = target.dataset.id;
      type = target.dataset.type; 
      if (!confirm(`Bạn có chắc muốn XÁC THỰC (approve) ${type} với ID: ${id}?`)) return;
      response = await fetch(`${API_ADMIN_URL}/approve/${type}/${id}`, { method: 'POST' });
      if (!response.ok) throw new Error(await response.json().then(d => d.detail));
      alert(`${type.charAt(0).toUpperCase() + type.slice(1)} đã được xác thực!`);
      loadContent(document.querySelector('.admin-sidebar .nav-link.active').dataset.view);
    }
    else if (target.classList.contains('btn-delete-user')) {
      id = target.dataset.id;
      if (!confirm(`Bạn có chắc muốn XÓA vĩnh viễn user: ${id}?`)) return;
      response = await fetch(`${API_ADMIN_URL}/users/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await response.json().then(d => d.detail));
      alert(`User ${id} đã bị xóa.`);
      loadContent(document.querySelector('.admin-sidebar .nav-link.active').dataset.view);
    }
    else if (target.classList.contains('btn-delete-clinic')) {
      id = target.dataset.id;
      if (!confirm(`Bạn có chắc muốn XÓA vĩnh viễn clinic: ${id}?`)) return;
      response = await fetch(`${API_ADMIN_URL}/clinics/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await response.json().then(d => d.detail));
      alert(`Clinic ${id} đã bị xóa.`);
      loadContent(document.querySelector('.admin-sidebar .nav-link.active').dataset.view);
    }
    else if (target.classList.contains('btn-delete-appointment')) {
      id = target.dataset.id;
      if (!confirm(`Bạn có chắc muốn XÓA lịch hẹn: ${id}?`)) return;
      response = await fetch(`${API_ADMIN_URL}/appointments/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await response.json().then(d => d.detail));
      alert(`Lịch hẹn ${id} đã bị xóa.`);
      loadContent(document.querySelector('.admin-sidebar .nav-link.active').dataset.view);
    }
    else if (target.classList.contains('btn-edit-user')) {
      id = target.dataset.id;
      handleEditUserClick(id);
    }
    else if (target.classList.contains('btn-edit-dentist')) {
      id = target.dataset.id;
      handleEditUserClick(id);
    }
    else if (target.id === 'btnSaveChanges') {
        handleSaveChanges();
    }
  } catch (error) {
    console.error('Lỗi khi thực hiện hành động:', error);
    alert(`Thao tác thất bại: ${error.message}`);
  }
}


// === CHẠY KHI TẢI TRANG ===
document.addEventListener('DOMContentLoaded', () => {
  // 1. Chạy hàm bảo vệ NGAY LẬP TỨC
  checkAdminAuth();

  // 2. Khởi tạo đối tượng Modal
  const modalElement = document.getElementById('adminEditModal');
  if (modalElement) {
    adminEditModal = new bootstrap.Modal(modalElement);
  }

  // 3. Gắn sự kiện cho nút Logout
  document.getElementById('logoutButton')?.addEventListener('click', handleLogout);

  // 4. Gắn sự kiện cho Sidebar
  const sidebarLinks = document.querySelectorAll('.admin-sidebar .nav-link');
  
  sidebarLinks.forEach(link => {
    const viewName = link.dataset.view; // Lấy từ 'data-view' trong HTML
    if(viewName){
        link.addEventListener('click', (e) => {
          e.preventDefault();
          sidebarLinks.forEach(l => l.classList.remove('active'));
          link.classList.add('active');
          
          // Ánh xạ data-view sang API endpoint
          const viewMapping = {
            'dashboard': 'dashboard',
            'users': 'users',
            'clinics': 'clinics',
            'dentists': 'dentists',
            'appointments': 'appointments',
            'reports': 'reports/customer', // Sửa ánh xạ
            'verification-queue': 'verification-queue'
          };
          
          loadContent(viewMapping[viewName]);
        });
    }
  });

  // 5. Gắn listener cho các hành động (cho toàn bộ document)
  document.addEventListener('click', handleAdminAction);
});