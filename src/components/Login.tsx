import React, { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, getDocFromServer } from 'firebase/firestore';
import { motion } from 'motion/react';
import { ChefHat, LogIn, Lock, Mail, ShieldAlert, Database, Wifi, WifiOff, CheckCircle2, XCircle, Info, ExternalLink, Settings, RefreshCw, HelpCircle } from 'lucide-react';
import appletConfig from '../../firebase-applet-config.json';

interface LoginProps {
  onLoginSuccess: (user: { id: string; role: 'admin' | 'delivery'; name: string }) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);



  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const inputVal = email.trim();
    const loginPassword = password;

    // 1. Check local storage / seeded users list first for the credentials!
    // This allows instant login and use of the application even in full offline/unprovisioned mode.
    const localUsersStr = localStorage.getItem('mma_users');
    let localUsersList: any[] = [];
    try {
      localUsersList = localUsersStr ? JSON.parse(localUsersStr) : [];
    } catch (e) {
      console.warn("Failed to parse local users", e);
    }
    
    // Always ensure master admin credentials are in the list for login fallback
    const masterAdmin = { id: 'admin_default_uid', name: 'Manjara Mane Aduge Admin', email: 'manjaramaneaduge@manjaramane.com', role: 'admin', phone: '9999999999', status: 'active', username: 'manjaramaneaduge', password: 'Password@123' };
    if (!Array.isArray(localUsersList) || localUsersList.length === 0 || !localUsersList.some((u: any) => u.username?.toLowerCase() === 'manjaramaneaduge')) {
      localUsersList = [masterAdmin, ...(Array.isArray(localUsersList) ? localUsersList : [])];
    }

    const matchedLocal = localUsersList.find((u: any) => 
      (u.username?.toLowerCase() === inputVal.toLowerCase() || u.email?.toLowerCase() === inputVal.toLowerCase()) && 
      u.password === loginPassword
    );

    if (matchedLocal) {
      onLoginSuccess({
        id: matchedLocal.id,
        role: matchedLocal.role as 'admin' | 'delivery',
        name: matchedLocal.name,
      });
      setLoading(false);

      // Attempt background Firestore sync safely in the background
      setTimeout(async () => {
        try {
          const userDocRef = doc(db, 'users', matchedLocal.id);
          // Omit password from cloud document for security, but keep profile
          const { password, ...safeUser } = matchedLocal;
          await setDoc(userDocRef, { ...safeUser, createdAt: new Date().toISOString() });
          console.log("Successfully seeded admin user in cloud Firestore users collection");
        } catch (dbErr) {
          console.warn("Background user sync skipped:", dbErr);
        }
      }, 10);
      return;
    }

    function withTimeout<T>(promise: Promise<T>, ms: number, errorKey: string): Promise<T> {
      return Promise.race([
        promise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(errorKey)), ms))
      ]);
    }

    try {

      // 2. Query the database for any user matching the email or username
      let foundUser: any = null;
      const usersRef = collection(db, 'users');
      
      const q1 = query(usersRef, where('email', '==', inputVal));
      const q1Snap = await withTimeout(getDocs(q1), 4000, 'DATABASE_TIMEOUT');
      if (!q1Snap.empty) {
        foundUser = { id: q1Snap.docs[0].id, ...q1Snap.docs[0].data() };
      } else {
        const q2 = query(usersRef, where('username', '==', inputVal));
        const q2Snap = await withTimeout(getDocs(q2), 4000, 'DATABASE_TIMEOUT');
        if (!q2Snap.empty) {
          foundUser = { id: q2Snap.docs[0].id, ...q2Snap.docs[0].data() };
        } else {
          const defaultEmail = inputVal.includes('@') ? inputVal : `${inputVal.toLowerCase()}@manjaramane.com`;
          const q3 = query(usersRef, where('email', '==', defaultEmail));
          const q3Snap = await withTimeout(getDocs(q3), 4000, 'DATABASE_TIMEOUT');
          if (!q3Snap.empty) {
            foundUser = { id: q3Snap.docs[0].id, ...q3Snap.docs[0].data() };
          }
        }
      }

      if (foundUser) {
        if (foundUser.password && foundUser.password === loginPassword) {
          onLoginSuccess({
            id: foundUser.id,
            role: foundUser.role,
            name: foundUser.name,
          });
          setLoading(false);
          return;
        }
      }

      // 3. Fallback to standard Firebase Auth if we can't find them with password in Firestore
      const resolvedEmail = inputVal.includes('@') ? inputVal : `${inputVal.toLowerCase()}@manjaramane.com`;
      const userCredential = await withTimeout(signInWithEmailAndPassword(auth, resolvedEmail, loginPassword), 4000, 'DATABASE_TIMEOUT');
      const uid = userCredential.user.uid;

      const userDoc = await withTimeout(getDoc(doc(db, 'users', uid)), 4000, 'DATABASE_TIMEOUT');
      if (userDoc.exists()) {
        const userData = userDoc.data();
        onLoginSuccess({
          id: uid,
          role: userData.role,
          name: userData.name,
        });
      } else {
        setError('User profile not found in database.');
      }
    } catch (err: any) {
      console.error("Login error details:", err);
      const errMsg = err?.message || '';
      if (errMsg === 'DATABASE_TIMEOUT') {
        setError('Database Connection Timeout: It seems your cloud Firestore database is taking longer than usual to respond. Please make sure your network is stable and that you have initialized the Firestore Database in your Firebase Console.');
      } else if (errMsg.includes('permission-denied') || errMsg.includes('insufficient permissions')) {
        setError('Database Connection Blocked: Please verify that you have enabled read/write access in your Firestore rules tab inside the Firebase Console.');
      } else if (errMsg.includes('not-found') || errMsg.includes('database') || errMsg.includes('null')) {
        setError('Firestore Not Initialized: Make sure you have clicked "Create database" under the "Firestore Database" section in your Firebase Console.');
      } else if (errMsg.includes('auth/') || errMsg.includes('user-not-found') || errMsg.includes('wrong-password')) {
        setError('Invalid credentials or the user profile was not found. Please verify your username and password and try again.');
      } else {
        setError(`Database Error: ${err.message || 'Please verify that Firestore Database and Email/Password Authentication are enabled in your project.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex flex-col items-center">
          <div className="w-72 max-w-full drop-shadow-xl mb-4">
            <img src="/logo.svg" alt="Manjara Mane Aduge" className="w-full h-auto" referrerPolicy="no-referrer" />
          </div>
          <h2 className="text-center text-3xl font-black text-slate-900 tracking-tight">
            Manjara Mane Aduge
          </h2>
        </div>
        <p className="mt-2 text-center text-sm text-slate-600">
          Daily Packed Food Catering Delivery & Billing Network
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white py-8 px-4 shadow-xl rounded-2xl sm:px-10 border border-slate-100"
        >
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg text-sm text-red-700">
              <div className="flex items-center">
                <ShieldAlert className="h-5 w-5 mr-2 text-red-500 shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          <div className="text-center mb-6">
            <h3 className="text-lg font-bold text-slate-800">
              Sign In to Your Account
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Enter your credentials to manage food dispatch & deliveries
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Email address or Username
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 block w-full px-3 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900 bg-slate-50/50 text-sm font-semibold"
                  placeholder="Enter email or username (e.g. Manjaramaneaduge)"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 block w-full px-3 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900 bg-slate-50/50 text-sm font-semibold"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors disabled:bg-emerald-400 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <span className="inline-block animate-spin border-2 border-white border-t-transparent rounded-full h-5 w-5 mr-2"></span>
                ) : (
                  <LogIn className="h-5 w-5 mr-2" />
                )}
                Sign In
              </button>
            </div>
          </form>

        </motion.div>
      </div>
    </div>
  );
}
