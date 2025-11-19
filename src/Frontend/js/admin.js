// File: /src/Frontend/js/admin.js (ĐÃ CẬP NHẬT HIỂN THỊ SERVICES)
const API_AUTH_URL = "http://localhost:8000/api/auth";
const API_ADMIN_URL = "http://localhost:8000/api/admin";

let currentAdmin = null;
let adminEditModal = null; 

let globalViewData = []; 
let currentView = 'dashboard'; 
let currentSearchTerm = ''; 
let currentPage = 1; 
const ITEMS_PER_PAGE = 10; 

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
 * HÀM 3: HÀM RENDER TỔNG
 */
function renderPage() {
  const tableContainer = document.getElementById('tableContainer');
  const searchContainer = document.getElementById('searchContainer');
  const paginationContainer = document.getElementById('paginationContainer');
  const viewTitle = document.getElementById('viewTitle');

  tableContainer.innerHTML = '';
  searchContainer.innerHTML = '';
  paginationContainer.innerHTML = '';

  if (currentView === 'dashboard') {
      viewTitle.textContent = 'Dashboard';
      renderDashboard(tableContainer, globalViewData); 
      return; 
  }
  
  if (currentView === 'verification-queue') {
      viewTitle.textContent = 'Verification Queue';
      renderVerificationQueue(tableContainer, globalViewData); 
      return; 
  }
  
  const dataArray = Array.isArray(globalViewData) ? globalViewData : [];
  
  const filteredData = dataArray.filter(item => {
    if (currentSearchTerm === '') return true;
    const term = currentSearchTerm.toLowerCase();
    
    switch (currentView) {
      case 'users':
      case 'dentists':
        return (item.first_name?.toLowerCase().includes(term) ||
                item.last_name?.toLowerCase().includes(term) ||
                item.email?.toLowerCase().includes(term) ||
                item.user_id?.toLowerCase().includes(term));
      case 'clinics':
        return (item.name?.toLowerCase().includes(term) ||
                item.address?.toLowerCase().includes(term) ||
                item.email?.toLowerCase().includes(term) ||
                item.clinic_id?.toLowerCase().includes(term));
      case 'appointments': 
         return (item.cust_first?.toLowerCase().includes(term) ||
                 item.cust_last?.toLowerCase().includes(term) ||
                 item.dent_first?.toLowerCase().includes(term) ||
                 item.dent_last?.toLowerCase().includes(term) ||
                 item.clinic_name?.toLowerCase().includes(term) ||
                 (item.services && item.services.join(' ').toLowerCase().includes(term)) || // (MỚI) Tìm theo services
                 item.status?.toLowerCase().includes(term));
       case 'reports': 
         return (item.reporter_email?.toLowerCase().includes(term) ||
                 item.reason?.toLowerCase().includes(term) ||
                 item.reported_entity_id?.toLowerCase().includes(term));
      default:
        return true;
    }
  });

  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  if (currentPage > totalPages && totalPages > 0) {
      currentPage = totalPages; 
  }
  const paginatedData = filteredData.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
  );
  
  renderSearchUI(searchContainer);
  
  switch (currentView) {
    case 'users':
      viewTitle.textContent = 'Manage Users';
      renderUsersTable(tableContainer, paginatedData);
      break;
    case 'clinics':
      viewTitle.textContent = 'Manage Clinics';
      renderClinicsTable(tableContainer, paginatedData);
      break;
    case 'dentists':
      viewTitle.textContent = 'Manage Dentists';
      renderDentistsTable(tableContainer, paginatedData);
      break;
    case 'appointments':
      viewTitle.textContent = 'Manage Appointments';
      renderAppointmentsTable(tableContainer, paginatedData); 
      break;
    case 'reports':
      viewTitle.textContent = 'View Reports';
      renderReportsTable(tableContainer, paginatedData); 
      break;
    default:
      viewTitle.textContent = 'Not Found';
      tableContainer.innerHTML = `<h1 class="h2">Trang không tìm thấy</h1>`;
  }
  
  if (totalPages > 1) {
      renderPaginationUI(paginationContainer, totalPages);
  }
}

/**
 * HÀM 4: TẢI NỘI DUNG
 */
async function loadContent(viewName) {
  currentView = viewName;
  currentPage = 1;
  currentSearchTerm = '';
  globalViewData = []; 

  const tableContainer = document.getElementById('tableContainer');
  tableContainer.innerHTML = `<div class="d-flex justify-content-center align-items-center" style="height: 50vh;"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>`;

  let url;
  const viewMapping = {
      'dashboard': `${API_ADMIN_URL}/dashboard-stats`,
      'users': `${API_ADMIN_URL}/users`,
      'clinics': `${API_ADMIN_URL}/clinics`,
      'dentists': `${API_ADMIN_URL}/dentists`,
      'appointments': `${API_ADMIN_URL}/appointments`, 
      'reports': `${API_ADMIN_URL}/reports`, 
      'verification-queue': `${API_ADMIN_URL}/verification-queue`
  };
  
  url = viewMapping[viewName];
  
  if (!url) {
      globalViewData = [];
      renderPage(); 
      return;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(await response.json().then(d => d.detail));
    const data = await response.json();
    
    if (viewName === 'dashboard' || viewName === 'verification-queue') {
        globalViewData = data;
    } else {
        globalViewData = Array.isArray(data) ? data : [];
    }
    
  } catch (error) {
    console.error(`Lỗi khi tải ${viewName}:`, error);
    tableContainer.innerHTML = `<div class="alert alert-danger">Không thể tải dữ liệu. Lỗi: ${error.message}</div>`;
  } finally {
    renderPage();
  }
}

/**
 * HÀM 5: CÁC HÀM RENDER UI (Search, Pagination)
 */
function renderSearchUI(container) {
    container.innerHTML = `
        <input type="text" class="form-control" id="dataSearchInput" placeholder="Tìm kiếm trong mục này..." value="${currentSearchTerm}">
    `;
    document.getElementById('dataSearchInput').addEventListener('input', (e) => {
        currentSearchTerm = e.target.value;
        currentPage = 1; 
        renderPage();
    });
}
function renderPaginationUI(container, totalPages) {
    let paginationHTML = '<nav aria-label="Page navigation"><ul class="pagination">';
    paginationHTML += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${currentPage - 1}">Previous</a></li>`;
    for (let i = 1; i <= totalPages; i++) {
        paginationHTML += `<li class="page-item ${i === currentPage ? 'active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
    }
    paginationHTML += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${currentPage + 1}">Next</a></li>`;
    paginationHTML += '</ul></nav>';
    container.innerHTML = paginationHTML;
    container.querySelectorAll('.page-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = parseInt(e.target.dataset.page);
            if (page && page !== currentPage && page >= 1 && page <= totalPages) {
                currentPage = page;
                renderPage();
            }
        });
    });
}


/**
 * HÀM 6: CÁC HÀM RENDER BẢNG
 */

// 6.1. Render Dashboard
function renderDashboard(area, stats) {
  if (!stats) { area.innerHTML = "<p>Loading dashboard...</p>"; return; }
  area.innerHTML = `
    <p class="text-muted">Welcome to the admin control panel, <span id="adminEmail" class="fw-bold">${currentAdmin.user_id}</span>.</p>
    <div class="row g-4 mt-3">
        <div class="col-md-3"><div class="stat-card text-bg-primary"><i class="bi bi-people-fill"></i><div><h5>Total Users</h5><p>${stats.total_users || 0}</p></div></div></div>
         <div class="col-md-3"><div class="stat-card text-bg-success"><i class="bi bi-person-badge"></i><div><h5>Total Dentists</h5><p>${stats.total_dentists || 0}</p></div></div></div>
         <div class="col-md-3"><div class="stat-card text-bg-warning"><i class="bi bi-calendar-check"></i><div><h5>Pending Bookings</h5><p>${stats.pending_bookings || 0}</p></div></div></div>
         <div class="col-md-3"><div class="stat-card text-bg-danger"><i class="bi bi-shield-check"></i><div><h5>New Reports</h5><p>${stats.new_reports || 0}</p></div></div></div>
    </div> 
    <h2 class="h4 mt-5">Quick Actions</h2>
    <div class="d-flex gap-3">
        <button class="btn btn-lg btn-outline-primary" onclick="loadContent('users')">Manage Users</button>
        <button class="btn btn-lg btn-outline-danger" onclick="loadContent('verification-queue')">View Verification Queue</button>
    </div>
  `;
}

// 6.2. Render Bảng Users
function renderUsersTable(area, users) {
  area.innerHTML = `
      <table class="table table-hover align-middle">
        <thead class="table-light">
          <tr>
            <th>User ID</th><th>Name</th><th>Email / Phone</th><th>Role</th><th>Status</th><th>Rep.</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${(users && users.length > 0) ? users.map(user => `
            <tr id="user-row-${user.user_id}">
              <td><small>${user.user_id}</small></td>
              <td>${user.first_name || ''} ${user.last_name || ''}</td>
              <td>${user.email}<br><small class="text-muted">${user.phone_number || ''}</small></td>
              <td>
                <span class="badge ${user.role === 'DENTIST' ? 'bg-success' : (user.role === 'ADMIN' ? 'bg-danger' : 'bg-primary')}">${user.role}</span>
              </td>
              <td>
                ${user.is_verified ? '<span class="badge bg-success">Verified</span>' : '<span class="badge bg-secondary">Pending</span>'}
                ${user.is_ban ? '<span class="badge bg-danger ms-1">Banned</span>' : ''}
              </td>
              <td>${user.reputation_score}</td>
              <td>
                <button class="btn btn-sm btn-outline-primary btn-edit-user" data-id="${user.user_id}" data-bs-toggle="modal" data-bs-target="#adminEditModal">Edit</button>
                <button class="btn btn-sm btn-outline-danger btn-delete-user" data-id="${user.user_id}" ${user.role === 'ADMIN' ? 'disabled' : ''}>Delete</button>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="7" class="text-center p-4">No users found.</td></tr>'}
        </tbody>
      </table>
  `;
}

// 6.3. Render Bảng Clinics
function renderClinicsTable(area, clinics) {
  area.innerHTML = `
      <table class="table table-hover align-middle">
        <thead class="table-light">
          <tr>
            <th>Clinic Name</th><th>Address</th><th>Contact</th><th>Status</th><th>Rep.</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${(clinics && clinics.length > 0) ? clinics.map(clinic => `
            <tr>
              <td><b>${clinic.name}</b><br><small class="text-muted">${clinic.clinic_id}</small></td>
              <td>${clinic.address}</td>
              <td>${clinic.email}<br><small>${clinic.phone_number}</small></td>
              <td>
                ${clinic.is_verified ? '<span class="badge bg-success">Verified</span>' : '<span class="badge bg-warning">Pending</span>'}
                ${clinic.is_ban ? '<span class="badge bg-danger ms-1">Banned</span>' : ''}
              </td>
              <td>${clinic.reputation_score}</td>
              <td>
                ${!clinic.is_verified ? `<button class="btn btn-sm btn-success btn-approve" data-type="clinic" data-id="${clinic.clinic_id}">Approve</button>` : ''}
                <button class="btn btn-sm btn-outline-danger btn-delete-clinic" data-id="${clinic.clinic_id}">Delete</button>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="6" class="text-center p-4">No clinics found.</td></tr>'}
        </tbody>
      </table>
  `;
}

// 6.4. Render Bảng Dentists
function renderDentistsTable(area, dentists) {
   area.innerHTML = `
      <table class="table table-hover align-middle">
        <thead class="table-light">
          <tr>
            <th>Dentist Name</th><th>Specialization</th><th>Email / Phone</th><th>Status</th><th>Rep.</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${(dentists && dentists.length > 0) ? dentists.map(dentist => `
            <tr>
              <td><b>${dentist.first_name} ${dentist.last_name}</b><br><small class="text-muted">${dentist.user_id}</small></td>
              <td>${dentist.specialization || 'N/A'}</td>
              <td>${dentist.email}<br><small>${dentist.phone_number}</small></td>
              <td>
                ${dentist.is_verified ? '<span class="badge bg-success">Verified</span>' : '<span class="badge bg-warning">Pending</span>'}
                ${dentist.is_ban ? '<span class="badge bg-danger ms-1">Banned</span>' : ''}
              </td>
              <td>${dentist.reputation_score}</td>
              <td>
                <button class="btn btn-sm btn-outline-primary btn-edit-dentist" data-id="${dentist.user_id}" data-bs-toggle="modal" data-bs-target="#adminEditModal">Edit</button>
                ${!dentist.is_verified ? `<button class="btn btn-sm btn-success btn-approve" data-type="dentist" data-id="${dentist.user_id}">Approve</button>` : ''}
                <button class="btn btn-sm btn-outline-danger btn-delete-user" data-id="${dentist.user_id}">Delete</button>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="6" class="text-center p-4">No dentists found.</td></tr>'}
        </tbody>
      </table>
  `;
}

// 6.5. Render Bảng Appointments (ĐÃ CẬP NHẬT)
function renderAppointmentsTable(area, appointments) {
  area.innerHTML = `
      <table class="table table-hover align-middle">
        <thead class="table-light">
          <tr>
            <th>Date & Time</th>
            <th>Customer</th>
            <th>Details (Dentist/Clinic)</th>
            <th>Services</th> <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${(appointments && appointments.length > 0) ? appointments.map(appt => `
            <tr>
              <td><b>${new Date(appt.appointment_datetime).toLocaleString('vi-VN')}</b></td>
              <td>${appt.cust_first || 'N/A'} ${appt.cust_last || ''}</td>
              <td>
                <b>${appt.dent_first || 'N/A'} ${appt.dent_last || ''}</b><br>
                <small class="text-muted">${appt.clinic_name || 'N/A'}</small>
              </td>
              <td>
                ${(appt.services && appt.services.length > 0)
                  ? appt.services.map(s => `<span class="badge bg-secondary me-1">${s}</span>`).join('')
                  : '<small class="text-muted">N/A</small>'}
              </td>
              <td><span class="badge bg-info">${appt.status}</span></td>
              <td>
                <button 
                  class="btn btn-sm btn-outline-primary btn-edit-appointment" 
                  data-id="${appt.appointment_id}"
                  data-bs-toggle="modal" 
                  data-bs-target="#adminEditModal"
                >
                  Edit
                </button>
                <button class="btn btn-sm btn-outline-danger btn-delete-appointment" data-id="${appt.appointment_id}">Delete</button>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="6" class="text-center p-4">No appointments found.</td></tr>'}
        </tbody>
      </table>
  `;
}

// 6.6. Render Bảng Reports
function renderReportsTable(area, reports) {
  area.innerHTML = `
    <table class="table table-hover align-middle">
      <thead class="table-light">
        <tr>
          <th>Date</th><th>Reporter</th><th>Reported Entity</th><th>Reason</th><th>Status</th><th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${(reports && reports.length > 0) ? reports.map(report => `
          <tr>
            <td>${new Date(report.created_at).toLocaleString('vi-VN')}</td>
            <td>
              <small>${report.reporter_email || 'N/A'}</small><br>
              <small class="text-muted">(${report.reporter_id || '...'})</small>
            </td>
            <td>
              <b>${report.reported_entity_type}</b><br>
              <small class="text-muted">(${report.reported_entity_id})</small>
            </td>
            <td>${report.reason}</td>
            <td>
              <span class="badge ${
                report.status === 'Pending' ? 'bg-warning' : (report.status === 'Resolved' ? 'bg-success' : 'bg-secondary')
              }">${report.status}</span>
            </td>
            <td>
              ${report.status === 'Pending' ? `
                <button class="btn btn-sm btn-success btn-resolve-report" data-id="${report.report_id}">Resolve</button>
                <button class="btn btn-sm btn-secondary btn-dismiss-report ms-1" data-id="${report.report_id}">Dismiss</button>
              ` : 'Đã xử lý'}
            </td>
          </tr>
        `).join('') : '<tr><td colspan="6" class="text-center p-4">No reports found.</td></tr>'}
      </tbody>
    </table>
  `;
}

// 6.7. Render Bảng Verification Queue
function renderVerificationQueue(area, data) {
  if (!data) { area.innerHTML = "<p>Loading verification queue...</p>"; return; }
  const { pending_dentists = [], pending_clinics = [] } = data || {};
  area.innerHTML = `
    <h3 class="h5 mt-4">Pending Dentists (${(pending_dentists || []).length})</h3>
    <div class="table-responsive bg-white rounded shadow-sm mb-4">
      <table class="table table-hover">
        <thead class="table-light"><tr><th>Name</th><th>Email</th><th>License</th><th>Action</th></tr></thead>
        <tbody>
          ${(pending_dentists || []).length > 0 ? pending_dentists.map(d => `
            <tr>
              <td>${d.first_name} ${d.last_name}</td><td>${d.email}</td><td>${d.license_num || 'N/A'}</td>
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
        <thead class="table-light"><tr><th>Name</th><th>Address</th><th>Email</th><th>Action</th></tr></thead>
        <tbody>
          ${(pending_clinics || []).length > 0 ? pending_clinics.map(c => `
            <tr>
              <td>${c.name}</td><td>${c.address}</td><td>${c.email}</td>
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

// 6.8. Render Form Sửa User (cho tab 'Manage Users')
function renderEditUserModal(area, user) {
  const dob = user.date_of_birth ? user.date_of_birth.split('T')[0] : '';
  const details = user.details || {};
  area.innerHTML = `
    <form id="editUserForm" data-id="${user.user_id}">
      <div class="mb-3"><label class="form-label">User ID</label><input type="text" class="form-control" value="${user.user_id}" disabled></div>
      <div class="row">
        <div class="col-md-6 mb-3"><label for="editEmail" class="form-label">Email</label><input type="email" class="form-control" id="editEmail" value="${user.email || ''}" required></div>
        <div class="col-md-6 mb-3"><label for="editPhone" class="form-label">Phone</label><input type="tel" class="form-control" id="editPhone" value="${user.phone_number || ''}"></div>
      </div>
      <hr><h5 class="h6">Personal Info</h5>
      <div class="row">
        <div class="col-md-4 mb-3"><label for="editFirstName" class="form-label">First Name</label><input type="text" class="form-control" id="editFirstName" value="${user.first_name || ''}"></div>
        <div class="col-md-4 mb-3"><label for="editMiddleName" class="form-label">Middle Name</label><input type="text" class="form-control" id="editMiddleName" value="${user.middle_name || ''}"></div>
        <div class="col-md-4 mb-3"><label for="editLastName" class="form-label">Last Name</label><input type="text" class="form-control" id="editLastName" value="${user.last_name || ''}"></div>
      </div>
      <div class="row">
        <div class="col-md-6 mb-3"><label for="editGender" class="form-label">Gender</label><select id="editGender" class="form-select"><option value="" ${!user.gender ? 'selected' : ''}>-- Select --</option><option value="Male" ${user.gender === 'Male' ? 'selected' : ''}>Male</option><option value="Female" ${user.gender === 'Female' ? 'selected' : ''}>Female</option><option value="Other" ${user.gender === 'Other' ? 'selected' : ''}>Other</option></select></div>
        <div class="col-md-6 mb-3"><label for="editDob" class="form-label">Date of Birth</label><input type="date" class="form-control" id="editDob" value="${dob}"></div>
      </div>
      <div class="mb-3"><label for="editAddress" class="form-label">Address</label><textarea class="form-control" id="editAddress" rows="2">${user.address || ''}</textarea></div>
      <hr><h5 class="h6">Admin Controls</h5>
      <div class="row">
         <div class="col-md-4 mb-3"><label for="editRole" class="form-label">Role</label><select id="editRole" class="form-select" ${user.role === 'ADMIN' ? 'disabled' : ''}><option value="CUSTOMER" ${user.role === 'CUSTOMER' ? 'selected' : ''}>CUSTOMER</option><option value="DENTIST" ${user.role === 'DENTIST' ? 'selected' : ''}>DENTIST</option><option value="ADMIN" ${user.role === 'ADMIN' ? 'selected' : ''}>ADMIN</option></select></div>
         <div class="col-md-5 mb-3"><label for="editNewPassword" class="form-label">New Password</label><input type="password" class="form-control" id="editNewPassword" placeholder="Để trống để giữ nguyên"></div>
         <div class="col-md-3 mb-3"><label for="editReputation" class="form-label">Reputation</label><input type="number" class="form-control" id="editReputation" value="${user.reputation_score || 100}"></div>
      </div>
      <div class="row">
        <div class="col-md-6 mb-3 form-check ms-3"><input type="checkbox" class="form-check-input" id="editVerified" ${user.is_verified ? 'checked' : ''}><label class="form-check-label" for="editVerified">Is Verified</label></div>
        <div class="col-md-5 mb-3 form-check"><input type="checkbox" class="form-check-input" id="editBanned" ${user.is_ban ? 'checked' : ''} ${user.role === 'ADMIN' ? 'disabled' : ''}><label class="form-check-label text-danger" for="editBanned">Is Banned</label></div>
      </div>
    </form>
  `;
}

// 6.9. Render Form Sửa Dentist (cho tab 'Manage Dentists')
function renderEditDentistModal(area, dentist) {
  const details = dentist.details || {};
  area.innerHTML = `
    <form id="editDentistForm" data-id="${dentist.user_id}">
      <div class="mb-3"><label class="form-label">User ID</label><input type="text" class="form-control" value="${dentist.user_id}" disabled></div>
      <div class="mb-3"><label class="form-label">Email</label><input type="email" class="form-control" value="${dentist.email}" disabled></div>
      <hr>
      <div class="row">
        <div class="col-md-6 mb-3"><label for="editFirstName" class="form-label">First Name</label><input type="text" class="form-control" id="editFirstName" value="${dentist.first_name || ''}" required></div>
        <div class="col-md-6 mb-3"><label for="editLastName" class="form-label">Last Name</label><input type="text" class="form-control" id="editLastName" value="${dentist.last_name || ''}" required></div>
      </div>
      <div class="mb-3"><label for="editPhone" class="form-label">Phone</label><input type="tel" class="form-control" id="editPhone" value="${dentist.phone_number || ''}" required></div>
      <div class="mb-3"><label for="editSpecialization" class="form-label">Specialization</label><input type="text" class="form-control" id="editSpecialization" value="${details.specialization || ''}"></div>
      <div class="mb-3"><label for="editYearsExp" class="form-label">Years of Exp</label><input type="number" class="form-control" id="editYearsExp" value="${details.years_of_exp || 0}"></div>
      <div class="mb-3"><label for="editBio" class="form-label">Bio</label><textarea class="form-control" id="editBio" rows="3">${details.bio || ''}</textarea></div>
      <div class="mb-3 form-check"><input type="checkbox" class="form-check-input" id="editVerified" ${dentist.is_verified ? 'checked' : ''}><label class="form-check-label" for="editVerified">Is Verified</label></div>
    </form>
  `;
}

// 6.10. (MỚI) Render Form Sửa Appointment (cho tab 'Manage Appointments')
function renderEditAppointmentModal(area, apptData, allDentists, allClinics) {
  // Định dạng datetime-local (YYYY-MM-DDTHH:mm)
  const apptDateTime = new Date(apptData.appointment_datetime).toISOString().slice(0, 16);
  
  area.innerHTML = `
    <form id="editAppointmentForm" data-id="${apptData.appointment_id}">
      <div class="mb-3">
        <label class="form-label">Appointment ID</label>
        <input type="text" class="form-control" value="${apptData.appointment_id}" disabled>
      </div>
      <div class="mb-3">
        <label for="editApptDateTime" class="form-label">Date & Time</label>
        <input type="datetime-local" class="form-control" id="editApptDateTime" value="${apptDateTime}" required>
      </div>
      
      <div class="row">
        <div class="col-md-6 mb-3">
          <label for="editApptStatus" class="form-label">Status</label>
          <select id="editApptStatus" class="form-select" required>
            <option value="Pending" ${apptData.status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Confirmed" ${apptData.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
            <option value="Cancelled" ${apptData.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            <option value="Completed" ${apptData.status === 'Completed' ? 'selected' : ''}>Completed</option>
          </select>
        </div>
      </div>

      <div class="row">
        <div class="col-md-6 mb-3">
          <label for="editApptDentist" class="form-label">Dentist</label>
          <select id="editApptDentist" class="form-select" required>
            <option value="">-- Chọn nha sĩ --</option>
            ${allDentists.map(d => `
              <option value="${d.user_id}" ${d.user_id === apptData.dentist_id ? 'selected' : ''}>
                ${d.first_name} ${d.last_name} (${d.email})
              </option>
            `).join('')}
          </select>
        </div>
        <div class="col-md-6 mb-3">
          <label for="editApptClinic" class="form-label">Clinic</label>
          <select id="editApptClinic" class="form-select" required>
            <option value="">-- Chọn phòng khám --</option>
            ${allClinics.map(c => `
              <option value="${c.clinic_id}" ${c.clinic_id === apptData.clinic_id ? 'selected' : ''}>
                ${c.name}
              </option>
            `).join('')}
          </select>
        </div>
      </div>
      
      <div class="mb-3">
        <label class="form-label">Services</label>
        <div class="p-2 bg-light rounded border">
          ${(apptData.services && apptData.services.length > 0)
            ? apptData.services.map(s => `<span class="badge bg-primary me-1">${s.name || s}</span>`).join('') // Sửa: s.name (từ API /appt/{id}) hoặc s (từ API /appointments)
            : '<span class="text-muted">Không có dịch vụ nào được đăng ký.</span>'}
        </div>
        <small class="text-muted">(Dịch vụ không thể sửa tại đây)</small>
      </div>
      
      <div class="mb-3">
        <label for="editApptNotes" class="form-label">Notes</label>
        <textarea class="form-control" id="editApptNotes" rows="3">${apptData.notes || ''}</textarea>
      </div>
    </form>
  `;
}


/**
 * HÀM 7: XỬ LÝ CÁC HÀNH ĐỘNG (CLICK NÚT)
 */

// 7.1. Xử lý khi click nút Edit User/Dentist
async function handleEditUserClick(id) {
  const modalBody = document.getElementById('adminEditModalBody');
  const modalTitle = document.getElementById('adminEditModalLabel');
  modalBody.innerHTML = '<div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div>';
  
  try {
    const response = await fetch(`${API_ADMIN_URL}/users/${id}`);
    if (!response.ok) throw new Error('Failed to fetch user details');
    const user = await response.json();

    if(currentView === 'dentists') {
       modalTitle.textContent = `Edit Dentist Details: ${id}`;
       renderEditDentistModal(modalBody, user);
    } else {
       modalTitle.textContent = `Edit User: ${id}`;
       renderEditUserModal(modalBody, user);
    }
    
  } catch (error) {
    modalBody.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
  }
}

// 7.2. (MỚI) Xử lý khi click nút Edit Appointment
async function handleEditAppointmentClick(id) {
  const modalBody = document.getElementById('adminEditModalBody');
  const modalTitle = document.getElementById('adminEditModalLabel');
  modalTitle.textContent = `Edit Appointment: ${id}`;
  modalBody.innerHTML = '<div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div>';

  try {
    const [apptRes, dentistsRes, clinicsRes] = await Promise.all([
      fetch(`${API_ADMIN_URL}/appointments/${id}`),
      fetch(`${API_ADMIN_URL}/dentists`), 
      fetch(`${API_ADMIN_URL}/clinics`)
    ]);

    if (!apptRes.ok) throw new Error('Failed to fetch appointment details');
    if (!dentistsRes.ok) throw new Error('Failed to fetch dentists list');
    if (!clinicsRes.ok) throw new Error('Failed to fetch clinics list');

    const apptData = await apptRes.json();
    const allDentists = await dentistsRes.json();
    const allClinics = await clinicsRes.json();

    renderEditAppointmentModal(modalBody, apptData, allDentists, allClinics);

  } catch (error) {
    modalBody.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
  }
}


// 7.3. Xử lý khi nhấn "Save changes" (ĐÃ CẬP NHẬT)
async function handleSaveChanges() {
  const editUserForm = document.getElementById('editUserForm');
  const editDentistForm = document.getElementById('editDentistForm');
  const editAppointmentForm = document.getElementById('editAppointmentForm'); 
  
  let id, body, response, endpoint;
  
  try {
    if (editUserForm) {
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
        new_password: newPassword ? newPassword : null,
        is_verified: document.getElementById('editVerified').checked,
        is_ban: document.getElementById('editBanned').checked,
        reputation_score: parseInt(document.getElementById('editReputation').value, 10)
      };

    } else if (editDentistForm) {
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

    } else if (editAppointmentForm) {
      id = editAppointmentForm.dataset.id;
      endpoint = `${API_ADMIN_URL}/appointments/${id}`;
      const localDateTime = document.getElementById('editApptDateTime').value;
      const isoDateTime = new Date(localDateTime).toISOString();
      body = {
        appointment_datetime: isoDateTime,
        status: document.getElementById('editApptStatus').value,
        dentist_id: document.getElementById('editApptDentist').value,
        clinic_id: document.getElementById('editApptClinic').value,
        notes: document.getElementById('editApptNotes').value || null
      };
    }
    
    response = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(await response.json().then(d => d.detail));
    
    alert('Cập nhật thành công!');
    adminEditModal.hide(); 
    loadContent(currentView); 

  } catch (error) {
    console.error('Lỗi khi lưu thay đổi:', error);
    alert(`Lỗi: ${error.message}`);
  }
}


// 7.4. Hàm xử lý action chính (dùng event delegation) (ĐÃ CẬP NHẬT)
async function handleAdminAction(e) {
  const target = e.target.closest('button');
  if (!target) return;

  let id, type, response;

  try {
    if (target.classList.contains('btn-edit-appointment')) {
      id = target.dataset.id;
      handleEditAppointmentClick(id); 
    }
    else if (target.classList.contains('btn-resolve-report')) {
      id = target.dataset.id;
      if (!confirm(`Bạn có chắc muốn 'Resolve' report: ${id}?`)) return;
      response = await fetch(`${API_ADMIN_URL}/reports/${id}/resolve`, { method: 'POST' });
      if (!response.ok) throw new Error(await response.json().then(d => d.detail));
      alert(`Report ${id} đã được giải quyết (Resolved).`);
      loadContent(currentView);
    }
    else if (target.classList.contains('btn-dismiss-report')) {
      id = target.dataset.id;
      if (!confirm(`Bạn có chắc muốn 'Dismiss' report: ${id}?`)) return;
      response = await fetch(`${API_ADMIN_URL}/reports/${id}/dismiss`, { method: 'POST' });
      if (!response.ok) throw new Error(await response.json().then(d => d.detail));
      alert(`Report ${id} đã bị bỏ qua (Dismissed).`);
      loadContent(currentView);
    }
    else if (target.classList.contains('btn-approve')) {
      id = target.dataset.id;
      type = target.dataset.type; 
      if (!confirm(`Bạn có chắc muốn XÁC THỰC (approve) ${type} với ID: ${id}?`)) return;
      response = await fetch(`${API_ADMIN_URL}/approve/${type}/${id}`, { method: 'POST' });
      if (!response.ok) throw new Error(await response.json().then(d => d.detail));
      alert(`${type.charAt(0).toUpperCase() + type.slice(1)} đã được xác thực!`);
      loadContent(currentView);
    }
    else if (target.classList.contains('btn-delete-user')) {
      id = target.dataset.id;
      if (!confirm(`Bạn có chắc muốn XÓA vĩnh viễn user: ${id}?`)) return;
      response = await fetch(`${API_ADMIN_URL}/users/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await response.json().then(d => d.detail));
      alert(`User ${id} đã bị xóa.`);
      loadContent(currentView);
    }
    else if (target.classList.contains('btn-delete-clinic')) {
      id = target.dataset.id;
      if (!confirm(`Bạn có chắc muốn XÓA vĩnh viễn clinic: ${id}?`)) return;
      response = await fetch(`${API_ADMIN_URL}/clinics/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await response.json().then(d => d.detail));
      alert(`Clinic ${id} đã bị xóa.`);
      loadContent(currentView);
    }
    else if (target.classList.contains('btn-delete-appointment')) {
      id = target.dataset.id;
      if (!confirm(`Bạn có chắc muốn XÓA lịch hẹn: ${id}?`)) return;
      response = await fetch(`${API_ADMIN_URL}/appointments/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await response.json().then(d => d.detail));
      alert(`Lịch hẹn ${id} đã bị xóa.`);
      loadContent(currentView);
    }
    else if (target.classList.contains('btn-edit-user') || target.classList.contains('btn-edit-dentist')) {
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
  checkAdminAuth();

  const modalElement = document.getElementById('adminEditModal');
  if (modalElement) {
    adminEditModal = new bootstrap.Modal(modalElement);
  }

  document.getElementById('logoutButton')?.addEventListener('click', handleLogout);

  const sidebarLinks = document.querySelectorAll('.admin-sidebar .nav-link');
  sidebarLinks.forEach(link => {
    const viewName = link.dataset.view;
    if(viewName){
        link.addEventListener('click', (e) => {
          e.preventDefault();
          sidebarLinks.forEach(l => l.classList.remove('active'));
          link.classList.add('active');
          const viewMapping = {
            'dashboard': 'dashboard',
            'users': 'users',
            'clinics': 'clinics',
            'dentists': 'dentists',
            'appointments': 'appointments',
            'reports': 'reports', 
            'verification-queue': 'verification-queue'
          };
          loadContent(viewMapping[viewName]);
        });
    }
  });

  document.addEventListener('click', handleAdminAction);
});