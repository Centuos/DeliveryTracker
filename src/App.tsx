import { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import DeliveryDashboard from './components/DeliveryDashboard';
import { ChefHat, Loader2 } from 'lucide-react';

interface UserSession {
  id: string;
  role: 'admin' | 'delivery';
  name: string;
}

export default function App() {
  const [session, setSession] = useState<UserSession | null>(() => {
    const cached = localStorage.getItem('mma_session');
    return cached ? JSON.parse(cached) : null;
  });
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch user profile from firestore database
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const userSession: UserSession = {
              id: firebaseUser.uid,
              role: userData.role,
              name: userData.name || 'User',
            };
            setSession(userSession);
            localStorage.setItem('mma_session', JSON.stringify(userSession));
          } else {
            // Check if we have a local session before logging out
            if (!localStorage.getItem('mma_session')) {
              console.warn('Authenticated user does not have a database profile. Logging out.');
              await signOut(auth);
              setSession(null);
            }
          }
        } catch (err) {
          console.error('Error loading user profile from database, using cached local session if available:', err);
          // Do not force log out if we already have a valid local session
          if (!localStorage.getItem('mma_session')) {
            await signOut(auth);
            setSession(null);
          }
        }
      } else {
        // If firebase auth has no user, but we have a custom Admin bypass login, preserve it
        const cached = localStorage.getItem('mma_session');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.id === 'admin_default_uid' || parsed.id === 'rider_1' || parsed.id === 'rider_2') {
            setSession(parsed);
          } else {
            setSession(null);
            localStorage.removeItem('mma_session');
          }
        } else {
          setSession(null);
        }
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLoginSuccess = (userSession: UserSession) => {
    setSession(userSession);
    localStorage.setItem('mma_session', JSON.stringify(userSession));
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('mma_session');
      setSession(null);
      await signOut(auth);
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center">
          <div className="w-64 max-w-full drop-shadow-xl animate-pulse">
            <img src="/logo.svg" alt="Manjara Mane Aduge" className="w-full h-auto" referrerPolicy="no-referrer" />
          </div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Manjara Mane Aduge</h2>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-bold bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-xs">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
            Synchronizing Database Connections...
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (session.role === 'admin') {
    return <AdminDashboard adminUser={session} onLogout={handleLogout} />;
  }

  return <DeliveryDashboard riderUser={session} onLogout={handleLogout} />;
}
