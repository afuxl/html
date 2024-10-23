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
// Fungsi untuk membuat ikon kapal yang berputar berdasarkan tipe kapal
function createRotatingIcon(course, shipType) {
    let color = '#00AA16'; // Warna default jika tidak ada kecocokan

    // Tentukan warna berdasarkan tipe kapal
    switch (shipType.toLowerCase()) {
        case 'passenger':
            color = '#8A2BE2'; // Ungu
            break;
        case 'container':
            color = '#87CEEB'; // Biru muda
            break;
        case 'fishing':
            color = '#FFA07A'; // Orange
            break;
        case 'tug/towing':
            color = '#3CB371'; // Hijau tua
            break;
        case 'offshore':
            color = '#FF00FF'; // Magenta
            break;
        case 'platform':
            color = '#FF00FF'; // Magenta (Sama seperti offshore dalam gambar)
            break;
        case 'non-merchant':
            color = '#F0FFFF'; // Putih
            break;
        case 'sar':
            color = '#FF8C00'; // Orange gelap
            break;
        case 'others':
            color = '#D3D3D3'; // Abu-abu muda
            break;
        case 'non-ship':
            color = '#D3D3D3'; // Abu-abu (Sama dengan Others)
            break;
        case 'unmatched':
            color = '#000000'; // Hitam
            break;
        case 'kn':
            color = '#A9A9A9'; // Abu-abu
            break;
        case 'kn sar':
            color = '#FF0000'; // Merah
            break;
        case 'kn kplp':
            color = '#0000FF'; // Biru
            break;
        case 'kn kenavigasian':
            color = '#FFD700'; // Emas
            break;
        case 'kri':
            color = '#00AA16'; // Hijau
            break;

        // Tambahan tipe kapal baru
        case 'tanker':
            color = '#FF4500'; // Oranye kemerahan
            break;
        case 'bulkcarrier':
            color = '#8B4513'; // Cokelat (Seperti Bulkcarrier)
            break;
        case 'dry cargo':
            color = '#4682B4'; // Biru baja (Steel Blue)
            break;

        default:
            color = '#00AA16'; // Hitam sebagai default
    }

    // Buat ikon dengan warna yang ditentukan
    return L.divIcon({
        html: `<div style="transform: rotate(${course}deg); width: 30px; height: 30px;">
                <svg fill="${color}" height="30px" width="30px" version="1.1" 
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

            // Jika zoom maksimal, tambahkan heading line
            if (map.getZoom() === 19) {
                Object.values(currentMap).forEach(ship => {
                    const headingLine = createHeadingLine(ship);
                    if (headingLine) {
                        headingLine.addTo(map);
                    }
                });
            }
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
    const course = ship[17] || 0;

    if (latitude && longitude) {
        const marker = L.marker([latitude, longitude], { icon: createRotatingIcon(course, ship[10]) });

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

    const flagEmoji = flag ? getFlagEmoji(flag) : "-";
    const latDMS = toDMS(ship[4], 'lat');
    const lonDMS = toDMS(ship[3], 'lon');

    return `
        <center><b><i>${ship[8] || mmsi}</i></b><br><br></center>
        MMSI: ${mmsi}<br>
        Tipe Kapal: ${shipType}<br>
        IMO: ${imo || '-'}<br>
        Bendera: ${flagEmoji}<br>
        Call Sign: ${callSign || '-'}<br>
        Kecepatan: ${speed || '-'} knots<br>
        Status: ${navStatus || '-'}<br>
        Tujuan: ${destination || '-'}<br>
        GT: ${gt || '-'}<br>
        Koordinat: ${latDMS}, ${lonDMS}<br>
        Data Terakhir: ${new Date(timestamp * 1000).toLocaleString()}<br>
        Sumber: ${source || '-'} (${timeAgo(timestamp)})<br>
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

    // Filter kapal berdasarkan nama, MMSI, atau call sign
    const filteredShips = Object.values(shipData).filter(ship => {
        const name = ship[8] || ''; // Nama kapal
        const mmsi = ship[0] || ''; // MMSI kapal
        const callSign = ship[9] || ''; // Call sign kapal

        // Cek apakah searchValue cocok dengan salah satu dari tiga data
        return name.toLowerCase().includes(searchValue) || 
               mmsi.toLowerCase().includes(searchValue) || 
               callSign.toLowerCase().includes(searchValue);
    });

    if (filteredShips.length > 0) {
        suggestionBox.style.display = 'block'; // Tampilkan daftar saran

        filteredShips.forEach(ship => {
            const name = ship[8] || ship[0]; // Nama kapal atau MMSI
            const mmsi = ship[0]; // MMSI
            const callSign = ship[9] || '-'; // Call sign atau "N/A" jika tidak ada

            const suggestionItem = document.createElement('li');
            suggestionItem.style.padding = '5px';
            suggestionItem.style.cursor = 'pointer';
            suggestionItem.textContent = `${name} (MMSI: ${mmsi}, Call Sign: ${callSign})`;

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
// Fungsi untuk menambahkan marker kapal dan heading line
// Fungsi untuk menambahkan marker kapal
function addShipMarker(ship) {
    const mmsi = ship[0];
    const name = ship[8] || mmsi;
    const latitude = ship[4];
    const longitude = ship[3];
    const course = ship[17] || 0;

    if (latitude && longitude) {
        const marker = L.marker([latitude, longitude], { icon: createRotatingIcon(course, ship[10]) });

        marker.bindTooltip(name, { permanent: false, direction: "top", className: 'ship-tooltip' });
        marker.bindPopup(createPopupContent(ship)); // Gunakan fungsi popup yang sama
        markers.addLayer(marker);

        // Tambahkan heading line hanya jika zoom maksimal
        if (map.getZoom() === 19) {
            const headingLine = createHeadingLine(ship);
            if (headingLine) {
                headingLine.addTo(map);
            }
        }
    }
}


// Fungsi untuk membuat garis heading
// Fungsi untuk membuat garis heading dari posisi kapal
function createHeadingLine(ship) {
    const latitude = ship[4];
    const longitude = ship[3];
    const heading = ship[2]; // Ambil data heading

    if (heading === null || heading === undefined || latitude === undefined || longitude === undefined) {
        return null; // Jika data tidak lengkap, tidak membuat garis
    }

    const headingLength = 0.5; // Panjang garis dalam km (500 meter)
    const endPoint = calculateDestinationPoint(latitude, longitude, heading, headingLength);

    // Buat polyline dari posisi kapal ke arah heading
    return L.polyline([[latitude, longitude], endPoint], {
        color: 'red', // Warna garis
        weight: 2, // Ketebalan garis
        opacity: 0.8, // Transparansi garis
    });
}

// Fungsi untuk menghitung titik tujuan berdasarkan heading dan jarak
function calculateDestinationPoint(lat, lon, heading, distanceKm) {
    const R = 6371; // Radius bumi dalam kilometer
    const rad = Math.PI / 180;
    const bearing = heading * rad; // Konversi heading ke radian

    const lat1 = lat * rad;
    const lon1 = lon * rad;

    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distanceKm / R) +
        Math.cos(lat1) * Math.sin(distanceKm / R) * Math.cos(bearing));

    const lon2 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(distanceKm / R) * Math.cos(lat1),
        Math.cos(distanceKm / R) - Math.sin(lat1) * Math.sin(lat2));

    return [lat2 / rad, lon2 / rad]; // Kembalikan sebagai [latitude, longitude]
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
