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
  const [session, setSession] = useState<UserSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
      if (firebaseUser) {
        try {
          // Fetch user profile from firestore database
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setSession({
              id: firebaseUser.uid,
              role: userData.role,
              name: userData.name || 'User',
            });
          } else {
            // No profile document found
            console.warn('Authenticated user does not have a database profile. Logging out.');
            await signOut(auth);
            setSession(null);
          }
        } catch (err) {
          console.error('Error loading user profile:', err);
          await signOut(auth);
          setSession(null);
        }
      } else {
        setSession(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLoginSuccess = (userSession: UserSession) => {
    setSession(userSession);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSession(null);
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
