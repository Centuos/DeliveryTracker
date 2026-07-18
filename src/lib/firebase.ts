import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
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

// Use initializeFirestore with long-polling and disable fetch streams to guarantee iframe sandbox compatibility
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
} as any, appletConfig.firestoreDatabaseId || "(default)");

export { app, auth, db };
