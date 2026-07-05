// --- 1. FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyBJc3ME8keQ3jA_P8zov9KzJKUX7LOgkPE",
  authDomain: "tapreport-9a390.firebaseapp.com",
  projectId: "tapreport-9a390",
  storageBucket: "tapreport-9a390.firebasestorage.app",
  messagingSenderId: "1064723577952",
  appId: "1:1064723577952:web:2a722c55eab4f2fdfb1705"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- 2. MAP SETUP (Leaflet) ---
const map = L.map('map').setView([20.5937, 78.9629], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

let currentLat = 0;
let currentLng = 0;
let userMarker = null;

// --- 3. GET USER'S GPS LOCATION ---
function initLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            currentLat = position.coords.latitude;
            currentLng = position.coords.longitude;
            map.setView([currentLat, currentLng], 14);
            if (userMarker) map.removeLayer(userMarker);
            userMarker = L.marker([currentLat, currentLng]).addTo(map)
                .bindPopup("📍 You are here").openPopup();
        }, () => {
            alert("Please allow location access to report an issue.");
        });
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}
initLocation();

// --- 4. HANDLE FORM SUBMISSION (FIXED: Using Placeholder Images) ---
document.getElementById('reportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const loader = document.getElementById('loader');
    btn.disabled = true;
    loader.classList.remove('hidden');

    const issueType = document.getElementById('issueType').value;
    const name = document.getElementById('locationName').value;
    const desc = document.getElementById('description').value;

    if(!currentLat || !currentLng) {
        alert("Location not found. Please allow GPS.");
        btn.disabled = false;
        loader.classList.add('hidden');
        return;
    }

    try {
        // --- HACKATHON PATCH: Bypassing Firebase Storage ---
        // Instead of uploading an image, we generate a free, random placeholder image URL.
        const randomNum = Math.floor(Math.random() * 1000);
        const photoURL = `https://picsum.photos/seed/${randomNum}/400/300`;

        // --- SAVE DATA TO FIRESTORE ---
        await db.collection('reports').add({
            issueType: issueType,
            locationName: name,
            description: desc,
            photoURL: photoURL, // Saves the placeholder URL
            lat: currentLat,
            lng: currentLng,
            status: 'pending',
            upvotes: 0,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("SUCCESS: Report submitted successfully! (Using placeholder image)");
        document.getElementById('reportForm').reset();
        location.reload(); 
    } catch (error) {
        alert("CRITICAL ERROR: " + error.message);
        console.error(error);
    } finally {
        btn.disabled = false;
        loader.classList.add('hidden');
    }
});

// --- 5. LIVE MAP VIEW ---
db.collection('reports').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
            const data = change.doc.data();
            const id = change.doc.id;
            
            let emoji = '🚰';
            let color = '#0d6efd'; 
            let textColor = 'white';
            
            if(data.issueType === 'drainage') {
                emoji = '⚠️';
                color = '#ffc107'; 
                textColor = 'black';
            }

            let size = '30px';
            let fontSize = '16px';
            if(data.upvotes >= 3) {
                color = '#dc3545'; 
                size = '50px';
                fontSize = '24px';
            }

            const customIcon = L.divIcon({
                className: 'custom-icon',
                html: `<div style="background-color: ${color}; color: ${textColor}; border: 3px solid white; border-radius: 50%; width: ${size}; height: ${size}; display: flex; align-items: center; justify-content: center; font-size: ${fontSize}; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">${emoji}</div>`
            });

            const marker = L.marker([data.lat, data.lng], { icon: customIcon }).addTo(map);

            const issueTypeLabel = data.issueType === 'drainage' ? '⚠️ Drainage Blockage' : '🚰 Broken Tap';

            // Show the placeholder image in the popup
            marker.bindPopup(`
                <b>${issueTypeLabel}</b><br>
                <b>📍 ${data.locationName}</b><br>
                ${data.description}<br>
                <small>Status: <b>${data.status}</b> | 👍 ${data.upvotes} upvotes</small><br>
                <button onclick="upvoteReport('${id}')" style="background:#0d6efd; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; margin-top:5px;">👍 Upvote this</button>
                <img src="${data.photoURL}" width="100%" style="border-radius:4px; margin-top:5px;">
            `);
        }
    });
});

// --- 6. UPVOTE FUNCTION ---
// --- 6. UPVOTE FUNCTION (With LocalStorage protection) ---
window.upvoteReport = async (id) => {
    // 1. Check local storage to see if this ID has already been upvoted
    const upvotedReports = JSON.parse(localStorage.getItem('upvotedReports') || '[]');
    
    if (upvotedReports.includes(id)) {
        alert("You have already upvoted this report! One vote per user is allowed.");
        return; // Stop the function immediately
    }

    try {
        // 2. If not upvoted yet, update the database
        const docRef = db.collection('reports').doc(id);
        await docRef.update({
            upvotes: firebase.firestore.FieldValue.increment(1)
        });
        
        // 3. Save the ID to local storage so it can't be upvoted again on this device
        upvotedReports.push(id);
        localStorage.setItem('upvotedReports', JSON.stringify(upvotedReports));
        
        alert("Upvote added! Authorities will prioritize this location.");
    } catch (error) {
        alert("Error upvoting: " + error.message);
    }
};
