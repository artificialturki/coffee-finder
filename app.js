// Initialize map
let map = L.map('map').setView([0, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const useZip = document.getElementById("useZip");
const zipRow = document.getElementById("zipRow");
useZip.addEventListener("change", () => {
  zipRow.hidden = !useZip.checked;
});

// Function to search cafes
async function searchCafes(lat, lon) {
  statusEl.textContent = "Searching for coffee shops...";
  listEl.innerHTML = "";
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=coffee&limit=10&lat=${lat}&lon=${lon}&radius=10000`;
    const res = await fetch(url, { headers: { "User-Agent": "coffee-finder-demo" } });
    const data = await res.json();
    if (data.length === 0) {
      statusEl.textContent = "No coffee shops found nearby.";
      return;
    }
    statusEl.textContent = `Found ${data.length} places`;
    map.setView([lat, lon], 13);

    data.forEach(place => {
      let marker = L.marker([place.lat, place.lon]).addTo(map)
        .bindPopup(`<b>${place.display_name}</b>`);
      let li = document.createElement("li");
      li.textContent = place.display_name;
      let btn = document.createElement("button");
      btn.textContent = "Directions";
      btn.onclick = () => {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`, "_blank");
      };
      li.appendChild(btn);
      listEl.appendChild(li);
    });
  } catch (err) {
    statusEl.textContent = "Error fetching data.";
    console.error(err);
  }
}

// Use My Location
document.getElementById("locBtn").onclick = () => {
  if (!navigator.geolocation) {
    statusEl.textContent = "Geolocation not supported.";
    return;
  }
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude } = pos.coords;
    searchCafes(latitude, longitude);
  }, () => {
    statusEl.textContent = "Unable to access location.";
  });
};

// Search by ZIP + country
document.getElementById("searchBtn").onclick = async () => {
  if (useZip.checked) {
    const zip = document.getElementById("zipInput").value.trim();
    const country = document.getElementById("countryInput").value.trim();
    if (!zip || !country) {
      statusEl.textContent = "Enter ZIP and country code.";
      return;
    }
    const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=${country}&postalcode=${zip}&limit=1`;
    const res = await fetch(geoUrl);
    const loc = await res.json();
    if (loc.length === 0) {
      statusEl.textContent = "ZIP not found.";
      return;
    }
    searchCafes(loc[0].lat, loc[0].lon);
  } else {
    statusEl.textContent = "Enable location or ZIP search first.";
  }
};
