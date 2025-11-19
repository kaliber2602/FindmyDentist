// Lấy dữ liệu nha sĩ đã chọn
const dentist = JSON.parse(localStorage.getItem("selectedDentist"));
console.log(dentist);
if (!dentist) {
    document.body.innerHTML =
        "<div class='text-center mt-5'><h4>No dentist data found. Go back to <a href='find.html'>search</a>.</h4></div>";
} else {
    // Gán dữ liệu vào giao diện
    document.getElementById("dentistImage").src = dentist.image;
    document.getElementById("dentistName").innerText = dentist.name;
    document.getElementById("dentistClinic").innerHTML =
        `<strong>Clinic:</strong> ${dentist.clinic}`;
    document.getElementById("dentistCity").innerHTML =
        `<i class='bi bi-geo-alt'></i> ${dentist.address}`;
    document.getElementById("dentistSpecialty").innerHTML =
        `<strong>Specialty:</strong> ${dentist.specialty}`;
    document.getElementById("dentistService").innerHTML =
        `<strong>Service:</strong> ${dentist.service}`;
    document.getElementById("dentistRating").innerHTML =
        `<strong>Rating:</strong> ⭐ ${dentist.rating}`;
}

// Nút Book Appointment
document.getElementById("btnBook").addEventListener("click", () => {
    localStorage.setItem("selectedDentist", JSON.stringify(dentist));
    window.location.href = "booking.html";
});

// Nút Add to Compare
document.getElementById("btnCompare").addEventListener("click", () => {
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
});
