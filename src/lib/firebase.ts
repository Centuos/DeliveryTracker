import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import appletConfig from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: appletConfig.apiKey || "AIzaSyB41MwE-wQWhf0WY9WgLRSAbhQRGncJbfI",
  authDomain: appletConfig.authDomain || "delivery-tracker-768b7.firebaseapp.com",
  projectId: appletConfig.projectId || "delivery-tracker-768b7",
  storageBucket: appletConfig.storageBucket || "delivery-tracker-768b7.firebasestorage.app",
  messagingSenderId: appletConfig.messagingSenderId || "1091248311144",
  appId: appletConfig.appId || "1:1091248311144:web:626dd5abfff77f2c56a4dd",
  measurementId: appletConfig.measurementId || "G-SQW3XS8NG0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Use initializeFirestore with long-polling to prevent connection blocks inside iframes
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});


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
