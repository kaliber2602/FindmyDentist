const selectedDentist = JSON.parse(localStorage.getItem("selectedDentist"));
const contentArea = document.getElementById("contentArea");

// Nếu chưa chọn bác sĩ
if (!selectedDentist) {
  contentArea.innerHTML = `
    <div class="appointment-container">
      <div class="empty-state">
        <i class="bi bi-search display-4 text-primary mb-3"></i>
        <h5>No dentist selected yet.</h5>
        <p class="text-muted mb-4">Please find and select a dentist before booking an appointment.</p>
        <a href="find.html" class="btn btn-outline-primary px-4 py-2">Go to Find Page</a>
      </div>
    </div>
  `;
} else {
  contentArea.innerHTML = `
    <div class="appointment-container">
      <div class="doctor-section">
        <img src="${selectedDentist.image}" alt="${selectedDentist.name}">
        <div class="doctor-info">
          <h4>${selectedDentist.name}</h4>
          <p class="mb-1">${selectedDentist.specialty} | ${selectedDentist.clinic}</p>
          <p><i class="bi bi-geo-alt"></i> ${selectedDentist.city}</p>
        </div>
      </div>

      <div class="form-section">
        <h5 class="mb-3">Book Your Appointment</h5>
        <form id="appointmentForm" class="row g-3">
          <div class="col-md-6">
            <label for="patientName" class="form-label">Your Name</label>
            <input type="text" id="patientName" class="form-control" required />
          </div>

          <div class="col-md-6">
            <label for="patientEmail" class="form-label">Email</label>
            <input type="email" id="patientEmail" class="form-control" required />
          </div>

          <div class="col-md-6">
            <label for="appointmentDate" class="form-label">Preferred Date</label>
            <input type="date" id="appointmentDate" class="form-control" required />
          </div>

          <div class="col-md-6">
            <label for="appointmentTime" class="form-label">Preferred Time</label>
            <input type="time" id="appointmentTime" class="form-control" required />
          </div>

          <div class="col-12">
            <label for="notes" class="form-label">Notes (Optional)</label>
            <textarea id="notes" class="form-control" rows="3" placeholder="Any specific request or symptom..."></textarea>
          </div>

          <div class="col-12 text-center mt-3">
            <button type="submit" class="btn-book">Confirm Appointment</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById("appointmentForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("patientName").value;
    alert(`Appointment request sent successfully!\nThank you, ${name}.`);
    e.target.reset();
  });
}
