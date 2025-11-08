const container = document.getElementById("compareContainer");

function renderCompare() {
  const compareList = JSON.parse(localStorage.getItem("compareList")) || [];

  const boxes = [0, 1].map((i) => {
    const d = compareList[i];
    if (!d) {
      return `
        <div class="col-md-6">
          <div class="compare-box empty pulse d-flex flex-column justify-content-center align-items-center show">
            <p class="text-muted mb-3">Empty Slot</p>
            <a href="find.html" class="btn btn-add">Add Dentist to Compare</a>
          </div>
        </div>`;
    } else {
      return `
        <div class="col-md-6">
          <div class="compare-box show">
            <img src="${d.image}" alt="${d.name}">
            <h5 class="fw-bold">${d.name}</h5>
            <p class="mb-1"><strong>Specialty:</strong> ${d.specialty}</p>
            <p class="mb-1"><strong>Clinic:</strong> ${d.clinic}</p>
            <p class="mb-1"><strong>City:</strong> ${d.city}</p>
            <button class="btn btn-outline-danger mt-3" onclick="removeCompare('${d.name}')">Remove</button>
          </div>
        </div>`;
    }
  });

  container.innerHTML = boxes.join("");

  // Add fade-in animation
  document.querySelectorAll(".compare-box").forEach((box, i) => {
    setTimeout(() => box.classList.add("show"), 150 * i);
  });

  // Highlight when full
  const compareSection = document.querySelector(".compare-section");
  if (compareList.length === 2) {
    container.classList.add("full");
  } else {
    container.classList.remove("full");
  }
}

function removeCompare(name) {
  let compareList = JSON.parse(localStorage.getItem("compareList")) || [];
  compareList = compareList.filter((d) => d.name !== name);
  localStorage.setItem("compareList", JSON.stringify(compareList));

  // Add fade-out animation
  const boxes = document.querySelectorAll(".compare-box");
  boxes.forEach((b) => b.classList.remove("show"));
  setTimeout(renderCompare, 300);
}

renderCompare();
