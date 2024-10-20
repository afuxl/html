// Inisialisasi peta
var map = L.map('map').setView([-2.548926, 118.0148634], 5); // Indonesia center

// Basemap OpenStreetMap
var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map); // Default basemap

// Basemap Satelite
var satellite = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '© Google Satellite'
});

// Basemap Terrain
var terrain = L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '© Google Terrain'
});

// Menambahkan Layer Control
var baseMaps = {
    "OpenStreetMap": osm,
    "Satellite": satellite,
    "Terrain": terrain
};

L.control.layers(baseMaps, null, { position: 'topleft' }).addTo(map);

// Inisialisasi marker cluster
var markers = L.markerClusterGroup();
var autoUpdateInterval; // Variabel untuk menyimpan interval auto-update
let shipData = {}; // Variabel untuk menyimpan data kapal

// Fungsi untuk membuat ikon kapal yang berputar
function createRotatingIcon(course) {
    return L.divIcon({
        html: `<div style="transform: rotate(${course}deg); width: 30px; height: 30px;">
                <svg fill="#00AA16" height="30px" width="30px" version="1.1" 
                    xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
                    viewBox="0 0 1792 1792" xml:space="preserve">
                    <path d="M187.8,1659L896,132.9L1604.2,1659L896,1285.5L187.8,1659z"/>
                </svg>
            </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15],
        className: 'rotating-icon'
    });
}

function timeAgo(timestamp) {
    const now = new Date();
    const timeDifference = now - new Date(timestamp * 1000);

    const seconds = Math.floor(timeDifference / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return days + " hari lalu";
    } else if (hours > 0) {
        return hours + " jam lalu";
    } else if (minutes > 0) {
        return minutes + " menit lalu";
    } else {
        return seconds + " detik lalu";
    }
}

function getFlagEmoji(countryCode) {
    const codePoints = countryCode.toUpperCase().split('')
        .map(c => 0x1F1E6 - 65 + c.charCodeAt());
    return String.fromCodePoint(...codePoints);
}

function toDMS(deg, type) {
    const d = Math.floor(Math.abs(deg));
    const m = Math.floor((Math.abs(deg) - d) * 60);
    const s = ((Math.abs(deg) - d - m / 60) * 3600).toFixed(2);
    let direction;

    if (type === 'lat') {
        direction = deg >= 0 ? 'LU' : 'LS';
    } else {
        direction = deg >= 0 ? 'BT' : 'BB';
    }

    return `${d}°${m}'${s}" ${direction}`;
}

function updateLastUpdateTimestamp(apiTimestamp) {
    const timestamp = new Date(apiTimestamp * 1000).toLocaleString();
    document.getElementById('last-update').innerText = `Last update: ${timestamp}`;
}

function countVisibleShips() {
    var visibleMarkers = 0;
    markers.eachLayer(function (marker) {
        // Hanya hitung marker yang terlihat (tidak dalam bentuk cluster)
        if (map.getBounds().contains(marker.getLatLng())) {
            visibleMarkers++;
        }
    });
    // Update teks jumlah kapal yang terlihat
    document.getElementById('ship-count').innerText = `TOTAL VISIBLE SHIPS: ${visibleMarkers}`;
}

// Event listener untuk memperbarui jumlah kapal terlihat saat peta digerakkan atau di-zoom
map.on('moveend', countVisibleShips);
map.on('zoomend', countVisibleShips);

// Fungsi untuk mengambil data API dan memperbarui peta
var isFirstLoad = true; // Variabel untuk melacak apakah ini pertama kali data diambil

// Fungsi untuk menampilkan loading screen
function showLoadingScreen() {
    document.getElementById('loading-screen').style.display = 'flex'; // Tampilkan loading screen
}

// Fungsi untuk menyembunyikan loading screen
function hideLoadingScreen() {
    document.getElementById('loading-screen').style.display = 'none'; // Sembunyikan loading screen
}

// Fungsi untuk mengambil data API dan memperbarui peta
function fetchDataAndUpdateMap() {
    if (isFirstLoad) {
        showLoadingScreen(); // Hanya tampilkan loading screen pada pemuatan pertama kali
    }

    fetch('https://i-motion.dephub.go.id/api/localcurrentmap')
        .then(response => response.json())
        .then(data => {
            var currentMap = data.currentMap;
            var apiTimestamp = data.timestamp;

            // Simpan data kapal
            shipData = currentMap; // Simpan data kapal ke variabel global

            updateLastUpdateTimestamp(apiTimestamp);

            markers.clearLayers(); // Kosongkan marker yang ada

            for (var key in currentMap) {
                if (currentMap.hasOwnProperty(key)) {
                    var ship = currentMap[key];
                    addShipMarker(ship); // Tambahkan marker untuk kapal
                }
            }

            map.addLayer(markers); // Tambahkan marker ke peta
            countVisibleShips(); // Hitung jumlah kapal yang terlihat
        })
        .catch(error => console.error('Error fetching data:', error))
        .finally(() => {
            if (isFirstLoad) {
                hideLoadingScreen(); // Sembunyikan loading screen setelah data pertama kali dimuat
                isFirstLoad = false; // Set menjadi false agar tidak menampilkan loading screen lagi
            }
        });
}

// Fungsi untuk menambahkan marker kapal
function addShipMarker(ship) {
    const mmsi = ship[0];
    const name = ship[8] || mmsi;
    const latitude = ship[4];
    const longitude = ship[3];
    const course = ship[1] || 0;

    if (latitude && longitude) {
        const marker = L.marker([latitude, longitude], { icon: createRotatingIcon(course) });

        marker.bindTooltip(name, { permanent: false, direction: "top", className: 'ship-tooltip' });
        marker.bindPopup(createPopupContent(ship)); // Gunakan fungsi popup yang sama
        markers.addLayer(marker);
    }
}

// Fungsi untuk membuat konten popup
function createPopupContent(ship) {
    const mmsi = ship[0];
    const shipType = ship[10];
    const callSign = ship[9];
    const imo = ship[11];
    const flag = ship[14];
    const speed = ship[7];
    const navStatus = ship[15];
    const destination = ship[18];
    const gt = ship[13];
    const timestamp = ship[5];
    const source = ship[6];

    const flagEmoji = flag ? getFlagEmoji(flag) : "N/A";
    const latDMS = toDMS(ship[4], 'lat');
    const lonDMS = toDMS(ship[3], 'lon');

    return `
        <center><b><i>${ship[8] || mmsi}</i></b><br><br></center>
        MMSI: ${mmsi}<br>
        Tipe Kapal: ${shipType}<br>
        IMO: ${imo || 'N/A'}<br>
        Bendera: ${flagEmoji}<br>
        Call Sign: ${callSign || 'N/A'}<br>
        Kecepatan: ${speed || 'N/A'} knots<br>
        Status: ${navStatus || 'N/A'}<br>
        Tujuan: ${destination || 'N/A'}<br>
        GT: ${gt || 'N/A'}<br>
        Koordinat: ${latDMS}, ${lonDMS}<br>
        Data Terakhir: ${new Date(timestamp * 1000).toLocaleString()}<br>
        Sumber: ${source || 'N/A'} (${timeAgo(timestamp)})<br>
    `;
}

// Fungsi untuk mengatur interval auto-update
function setUpdateInterval() {
    const updateInterval = document.getElementById('update-interval').value;

    // Hentikan interval sebelumnya jika ada
    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
    }

    // Simpan pengaturan ke localStorage
    localStorage.setItem('autoUpdateInterval', updateInterval);

    // Jika interval lebih dari 0, set interval baru
    if (updateInterval > 0) {
        autoUpdateInterval = setInterval(fetchDataAndUpdateMap, updateInterval);
        fetchDataAndUpdateMap(); // Panggil sekali untuk mengambil data segera
    }
}

// Ambil pengaturan auto-update saat halaman dimuat
window.onload = function() {
    const savedInterval = localStorage.getItem('autoUpdateInterval') || 30000; // Default 30 detik
    document.getElementById('update-interval').value = savedInterval; // Set nilai input
    setUpdateInterval(); // Atur interval

    // Ambil data kapal saat halaman dimuat
    fetchDataAndUpdateMap();
};

// Pencarian kapal
function searchShip() {
    const searchValue = document.getElementById('ship-search').value.toLowerCase();
    const suggestionBox = document.getElementById('ship-suggestions');
    const notFoundMessage = document.getElementById('not-found-message');

    suggestionBox.innerHTML = ''; // Kosongkan saran sebelumnya
    suggestionBox.style.display = 'none'; // Sembunyikan saran jika tidak ada yang cocok
    notFoundMessage.style.display = 'none'; // Sembunyikan pesan "No ships found"

    if (searchValue === '') {
        return;
    }

    // Filter kapal berdasarkan nama
    const filteredShips = Object.values(shipData).filter(ship => {
        const name = ship[8] || ship[0]; // Gunakan MMSI jika nama tidak ada
        return name.toLowerCase().includes(searchValue);
    });

    if (filteredShips.length > 0) {
        suggestionBox.style.display = 'block'; // Tampilkan daftar saran

        filteredShips.forEach(ship => {
            const name = ship[8] || ship[0]; // Nama kapal atau MMSI
            const suggestionItem = document.createElement('li');
            suggestionItem.style.padding = '5px';
            suggestionItem.style.cursor = 'pointer';
            suggestionItem.textContent = name;

            // Ketika saran diklik, fokuskan peta pada kapal tersebut
            suggestionItem.onclick = function() {
                document.getElementById('ship-search').value = name;
                suggestionBox.style.display = 'none'; // Sembunyikan saran setelah memilih
                focusOnShip(ship); // Fokus pada kapal yang dipilih
            };

            suggestionBox.appendChild(suggestionItem); // Tambahkan saran ke daftar
        });
    } else {
        notFoundMessage.style.display = 'block'; // Tampilkan pesan jika tidak ada kapal
    }
}

// Fungsi untuk fokus pada kapal dan menampilkan popup
function focusOnShip(ship) {
    const latitude = ship[4];
    const longitude = ship[3];

    // Fokus pada posisi kapal
    map.setView([latitude, longitude], 16); // Atur zoom level sesuai kebutuhan

    // Temukan marker yang sesuai dan buka popup-nya
    markers.eachLayer(marker => {
        if (marker.getLatLng().lat === latitude && marker.getLatLng().lng === longitude) {
            marker.openPopup(); // Buka popup untuk marker kapal
        }
    });
}

// Event listeners
document.getElementById('ship-search').addEventListener('input', searchShip);
