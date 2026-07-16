import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB41MwE-wQWhf0WY9WgLRSAbhQRGncJbfI",
  authDomain: "delivery-tracker-768b7.firebaseapp.com",
  projectId: "delivery-tracker-768b7",
  storageBucket: "delivery-tracker-768b7.firebasestorage.app",
  messagingSenderId: "1091248311144",
  appId: "1:1091248311144:web:626dd5abfff77f2c56a4dd",
  measurementId: "G-SQW3XS8NG0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Use default firestore database for user's custom Firebase Project
const db = getFirestore(app);


// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a time.
    console.warn('Firestore persistence failed-precondition (multiple tabs open)');
  } else if (err.code === 'unimplemented') {
    // The current browser does not support all of the features required to enable persistence
    console.warn('Firestore persistence is unimplemented in this browser');
  }
});

export { app, auth, db };
