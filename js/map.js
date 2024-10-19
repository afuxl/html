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
            subdomains:['mt0','mt1','mt2','mt3'],
            attribution: '© Google Satellite'
        });

        // Basemap Terrain
        var terrain = L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains:['mt0','mt1','mt2','mt3'],
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

// Fungsi untuk membuat ikon kapal yang berputar
function createRotatingIcon(course) {
    return L.divIcon({
         html: `<div style="transform: rotate(${course}deg); width: 30px; height: 30px;">
                    <svg fill="#00AA16" height="30px" width="30px" version="1.1" id="Layer_1" 
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

// Fungsi untuk mengambil data API dan memperbarui peta
function fetchDataAndUpdateMap() {
    fetch('https://i-motion.dephub.go.id/api/localcurrentmap')
        .then(response => response.json())
        .then(data => {
            var currentMap = data.currentMap;
            var apiTimestamp = data.timestamp;

            updateLastUpdateTimestamp(apiTimestamp);

            markers.clearLayers();

            for (var key in currentMap) {
                if (currentMap.hasOwnProperty(key)) {
                    var ship = currentMap[key];
                    var mmsi = ship[0];
                    var shipType = ship[1];
                    var latitude = ship[4];
                    var longitude = ship[3];
                    var timestamp = ship[5];
                    var name = ship[8] || mmsi;
                    var callSign = ship[9];
                    var imo = ship[11];
                    var flag = ship[14];
                    var speed = ship[7];
                    var navStatus = ship[15];
                    var destination = ship[18];
                    var gt = ship[13];
                    var course = ship[17];
                    var source = ship[6];
                    var eta = ship[16];

                    var flagEmoji = flag ? getFlagEmoji(flag) : "N/A";

                    if (latitude && longitude) {
                        var marker = L.marker([latitude, longitude], { icon: createRotatingIcon(course || 0) });

                        marker.bindTooltip(`<b>${name}</b>`, { permanent: false, direction: "top", className: 'ship-tooltip' });

                        var latDMS = toDMS(latitude, 'lat');
                        var lonDMS = toDMS(longitude, 'lon');

                        marker.bindPopup(
                            `<center><b><i>${name}</i></b><br><br></center>` +
                            `MMSI: ${mmsi}<br>` +
                            `Tipe Kapal: ${shipType}<br>` +
                            `IMO: ${imo || 'N/A'}<br>` +
                            `Bendera: ${flagEmoji}<br>` +
                            `Call Sign: ${callSign || 'N/A'}<br>` +
                            `Kecepatan: ${speed || 'N/A'} knots<br>` +
                            `Status: ${navStatus || 'N/A'}<br>` +
                            `Tujuan: ${destination || 'N/A'}, Eta: ${eta || 'N/A'}<br>` +
                            `GT: ${gt || 'N/A'}<br>` +
                            `Koordinat: ${latDMS}, ${lonDMS}<br>` +
                            `Data Terakhir: ${new Date(timestamp * 1000).toLocaleString()}<br>` +
                            `Sumber: ${source || 'N/A'} (${timeAgo(timestamp)})<br><br>`
                        );

                        markers.addLayer(marker);
                    }
                }
            }

            map.addLayer(markers);
        })
        .catch(error => console.error('Error fetching data:', error));
}

// Jalankan fetchDataAndUpdateMap() saat halaman pertama kali dimuat
fetchDataAndUpdateMap();
