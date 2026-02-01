// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIza...", // Use your actual key here
  authDomain: "lifesync05.firebaseapp.com",
  // Use the asia-southeast1 URL you found in your console:
  databaseURL: "https://lifesync05-default-rtdb.asia-southeast1.firebasedatabase.app/", 
  projectId: "lifesync05",
  storageBucket: "lifesync05.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get a reference to the database service
export const db = getDatabase(app);
