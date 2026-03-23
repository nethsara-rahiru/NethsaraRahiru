// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAJr_C4IEW_NcZxY7sf7p-T3k_ZvhP-980",
  authDomain: "nethsara-rahiru-d0958.firebaseapp.com",
  projectId: "nethsara-rahiru-d0958",
  storageBucket: "nethsara-rahiru-d0958.firebasestorage.app",
  messagingSenderId: "106155518382",
  appId: "1:106155518382:web:60cf932d96eea3b1a1c03f",
  measurementId: "G-V1TKZK499J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
