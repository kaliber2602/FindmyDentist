// --- Mock Data (bạn có thể mở rộng thêm) ---
const dentists = [
  {
    name: "Dr. Emily Tran",
    specialty: "Orthodontics",
    city: "Ho Chi Minh City",
    clinic: "SmileCare Clinic",
    rating: 4.5,
    service: "Braces",
    type: "dentist",
    image: "/assets/imgs/dentist1.jpg",
  },
  {
    name: "Dr. Michael Nguyen",
    specialty: "Implant",
    city: "Hanoi",
    clinic: "Tooth & Care Dental",
    rating: 4.2,
    service: "Implant",
    type: "dentist",
    image: "/assets/imgs/dentist2.jpg",
  },
  {
    name: "BrightSmile Dental",
    specialty: "General Dentistry",
    city: "Da Nang",
    clinic: "BrightSmile Dental",
    rating: 4.8,
    service: "Cleaning",
    type: "clinic",
    image: "/assets/imgs/dentist3.jpg",
  },
];

// --- DOM Elements ---
const searchInput = document.getElementById("searchInput");
const resultsContainer = document.getElementById("resultsContainer");
const filterForm = document.getElementById("filterForm");

// --- Render Cards ---
function renderDentists(list) {
  if (!list.length) {
    resultsContainer.innerHTML = `<p class="text-center text-muted">No results found.</p>`;
    return;
  }

  resultsContainer.innerHTML = list
    .map(
      (d, index) => `
      <div class="col-md-4 col-sm-6">
        <div class="dentist-card shadow-sm rounded-4 p-2" data-index="${index}">
          <img src="${d.image}" alt="${d.name}" class="img-fluid rounded-3" />
          <div class="dentist-info mt-2">
            <h5>${d.name}</h5>
            <p class="mb-1"><strong>Specialty:</strong> ${d.specialty}</p>
            <p class="mb-1"><strong>Clinic:</strong> ${d.clinic}</p>
            <p class="mb-1 text-muted"><i class="bi bi-geo-alt"></i> ${d.city}</p>
            <p class="mb-2"><strong>Rating:</strong> ⭐ ${d.rating}</p>
            <div class="d-flex flex-column gap-2 mt-3">
              <button class="btn btn-outline-primary btn-view w-100">View Details</button>
              <button class="btn btn-success btn-book w-100">Book Appointment</button>
              <button class="btn btn-compare w-100">Add to Compare</button>
            </div>
          </div>
        </div>
      </div>
    `
    )
    .join("");

  attachEventListeners();
}

// --- Gắn Sự Kiện Cho Nút ---
function attachEventListeners() {
  document.querySelectorAll(".btn-compare").forEach((btn, index) => {
    btn.addEventListener("click", () => addToCompare(dentists[index]));
  });

  document.querySelectorAll(".btn-view").forEach((btn, index) => {
    btn.addEventListener("click", () => viewDetails(dentists[index]));
  });

  document.querySelectorAll(".btn-book").forEach((btn, index) => {
    btn.addEventListener("click", () => bookAppointment(dentists[index]));
  });
}

// --- Thêm vào Compare ---
function addToCompare(dentist) {
  let compareList = JSON.parse(localStorage.getItem("compareList")) || [];

  if (compareList.length >= 2) {
    alert("You can only compare up to 2 dentists/clinics.");
    return;
  }

  if (compareList.find((d) => d.name === dentist.name)) {
    alert("This dentist is already in your compare list!");
    return;
  }

  compareList.push(dentist);
  localStorage.setItem("compareList", JSON.stringify(compareList));
  alert(`${dentist.name} added to compare.`);
}

// --- Xem chi tiết ---
function viewDetails(dentist) {
  localStorage.setItem("selectedDentist", JSON.stringify(dentist));
  window.location.href = "dentist-detail.html";
}

// --- Đặt lịch hẹn ---
function bookAppointment(dentist) {
  localStorage.setItem("selectedDentist", JSON.stringify(dentist));
  window.location.href = "booking.html";
}

// --- Lọc nâng cao ---
function applyFilters(e) {
  e.preventDefault();

  const type = document.getElementById("searchType").value;
  const city = document.getElementById("city").value;
  const specialty = document.getElementById("specialtySelect").value;
  const service = document.getElementById("serviceSelect").value;
  const rating = document.getElementById("ratingSelect").value;
  const keyword = document.getElementById("keyword").value.trim().toLowerCase();

  let filtered = dentists.filter((d) => {
    return (
      (type === "all" || d.type === type) &&
      (!city || d.city.toLowerCase().includes(city.toLowerCase())) &&
      (!specialty || d.specialty.toLowerCase().includes(specialty.toLowerCase())) &&
      (!service || d.service.toLowerCase().includes(service.toLowerCase())) &&
      (!keyword ||
        d.name.toLowerCase().includes(keyword) ||
        d.clinic.toLowerCase().includes(keyword)) &&
      (!rating || parseInt(rating[0]) <= Math.floor(d.rating))
    );
  });

  const sortBy = document.getElementById("sortBy").value;
  filtered = filtered.sort((a, b) => {
    if (sortBy === "rating") return b.rating - a.rating;
    if (sortBy === "name") return a.name.localeCompare(b.name);
    return 0;
  });

  renderDentists(filtered);
}

// --- Tìm kiếm nhanh ---
function searchDentists() {
  const term = searchInput.value.trim().toLowerCase();
  const filtered = dentists.filter(
    (d) =>
      d.name.toLowerCase().includes(term) ||
      d.specialty.toLowerCase().includes(term) ||
      d.city.toLowerCase().includes(term) ||
      d.clinic.toLowerCase().includes(term)
  );
  renderDentists(filtered);
}

// --- Sự kiện ---
filterForm.addEventListener("submit", applyFilters);
document.querySelector(".btn-search").addEventListener("click", searchDentists);
searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") searchDentists();
});

// --- Render ban đầu ---
renderDentists(dentists);
