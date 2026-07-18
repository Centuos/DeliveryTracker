import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, query, where } from 'firebase/firestore';
import { Delivery } from '../types';
import { motion } from 'motion/react';
import {
  ChefHat,
  MapPin,
  Phone,
  CheckCircle,
  Truck,
  LogOut,
  Navigation,
  Clock,
  Check,
  AlertCircle,
  TrendingUp,
  Wifi,
  WifiOff
} from 'lucide-react';

interface DeliveryDashboardProps {
  riderUser: { id: string; name: string };
  onLogout: () => void;
}

export default function DeliveryDashboard({ riderUser, onLogout }: DeliveryDashboardProps) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [filterTab, setFilterTab] = useState<'my_jobs' | 'available' | 'completed'>('my_jobs');
  const [dateMode, setDateMode] = useState<'today' | 'tomorrow'>('today');
  const [alertMsg, setAlertMsg] = useState({ type: 'success', text: '' });

  // Dynamically calculate dateStr based on dateMode
  const dateStr = (() => {
    const d = new Date();
    if (dateMode === 'tomorrow') {
      d.setDate(d.getDate() + 1);
    }
    return d.toISOString().split('T')[0];
  })();

  useEffect(() => {
    // Initial fallback load
    const localDel = localStorage.getItem('mma_deliveries');
    if (localDel) {
      const allList: Delivery[] = JSON.parse(localDel);
      setDeliveries(allList.filter(d => d.date === dateStr));
    }

    // Realtime subscription to deliveries for selected date
    const q = query(collection(db, 'deliveries'), where('date', '==', dateStr));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Delivery[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Delivery);
      });
      if (list.length > 0) {
        setDeliveries(list);
        
        // Merge with current local deliveries so we don't wipe out other dates
        const localDel = localStorage.getItem('mma_deliveries');
        let allList: Delivery[] = localDel ? JSON.parse(localDel) : [];
        allList = allList.filter(d => d.date !== dateStr);
        allList.push(...list);
        localStorage.setItem('mma_deliveries', JSON.stringify(allList));
      }
    }, (error) => {
      console.warn("Delivery subscription failed (offline fallback active):", error);
    });

    return () => unsubscribe();
  }, [dateStr]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(() => {
    try {
      const queueStr = localStorage.getItem('mma_delivery_updates');
      return queueStr ? JSON.parse(queueStr).length : 0;
    } catch {
      return 0;
    }
  });

  const triggerAlert = (type: 'success' | 'error', text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg({ type: 'success', text: '' }), 3000);
  };

  // Sync offline updates queue to Cloud Firestore
  const syncOfflineDeliveries = async () => {
    if (!navigator.onLine) {
      try {
        const queueStr = localStorage.getItem('mma_delivery_updates');
        setPendingSyncCount(queueStr ? JSON.parse(queueStr).length : 0);
      } catch {}
      return;
    }

    const queueStr = localStorage.getItem('mma_delivery_updates');
    if (!queueStr) {
      setPendingSyncCount(0);
      return;
    }

    let queue: any[] = [];
    try {
      queue = JSON.parse(queueStr);
    } catch (e) {
      setPendingSyncCount(0);
      return;
    }

    if (queue.length === 0) {
      setPendingSyncCount(0);
      return;
    }

    setIsSyncing(true);
    setPendingSyncCount(queue.length);
    const remaining: any[] = [];

    for (const task of queue) {
      try {
        const deliveryRef = doc(db, 'deliveries', task.deliveryId);
        await updateDoc(deliveryRef, task.updates);
      } catch (err) {
        console.warn(`[Sync] Failed to upload task for delivery ${task.deliveryId}:`, err);
        remaining.push(task); // retain to retry later
      }
    }

    localStorage.setItem('mma_delivery_updates', JSON.stringify(remaining));
    setPendingSyncCount(remaining.length);
    setIsSyncing(false);

    if (remaining.length === 0 && queue.length > 0) {
      triggerAlert('success', 'All local delivery details uploaded and synced to cloud! ☁️');
    }
  };

  // Queue a delivery change locally and attempt background sync
  const queueUpdate = async (deliveryId: string, updates: any) => {
    // 1. Immediately update UI local state & local storage for instant offline feedback
    const localDel = localStorage.getItem('mma_deliveries');
    let allList: Delivery[] = localDel ? JSON.parse(localDel) : [];
    allList = allList.map(d => d.id === deliveryId ? { ...d, ...updates } : d);
    localStorage.setItem('mma_deliveries', JSON.stringify(allList));
    setDeliveries(allList.filter(d => d.date === dateStr));

    // 2. Push change details to the offline updates queue
    try {
      const queueStr = localStorage.getItem('mma_delivery_updates');
      let queue: any[] = queueStr ? JSON.parse(queueStr) : [];
      
      // Filter out duplicate pending tasks for this exact delivery to avoid conflicting states
      queue = queue.filter(task => task.deliveryId !== deliveryId);
      
      queue.push({
        deliveryId,
        updates,
        timestamp: Date.now()
      });
      localStorage.setItem('mma_delivery_updates', JSON.stringify(queue));
      setPendingSyncCount(queue.length);
    } catch (err) {
      console.error("Failed to write to offline storage queue:", err);
    }

    // 3. Fire-and-forget sync task if connected
    syncOfflineDeliveries();
  };

  // Sync listener on connection recovery
  useEffect(() => {
    const handleOnline = () => {
      syncOfflineDeliveries();
    };

    window.addEventListener('online', handleOnline);
    // Sync any leftover queue items from previous sessions on component mount
    syncOfflineDeliveries();

    const interval = setInterval(() => {
      syncOfflineDeliveries();
    }, 12000); // Poll and retry sync queue every 12 seconds if online

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, [dateStr]);

  // Claim unassigned delivery
  const handleClaimJob = async (delivery: Delivery) => {
    const updates = {
      deliveryBoyId: riderUser.id,
      deliveryBoyName: riderUser.name,
    };
    try {
      await queueUpdate(delivery.id, updates);
      triggerAlert('success', `Successfully claimed ${delivery.mealType} run for ${delivery.customerName}!`);
    } catch (err: any) {
      console.error(err);
      triggerAlert('error', 'Claiming failed: ' + err.message);
    }
  };

  // Unclaim a job (return it to the pool)
  const handleUnclaimJob = async (delivery: Delivery) => {
    const updates = {
      deliveryBoyId: null,
      deliveryBoyName: null,
    };
    try {
      await queueUpdate(delivery.id, updates);
      triggerAlert('success', `Returned run to the available pool.`);
    } catch (err: any) {
      console.error(err);
      triggerAlert('error', 'Returning failed: ' + err.message);
    }
  };

  // Mark as Picked Up / Start Delivery (for claimed jobs)
  const handlePickUp = async (delivery: Delivery) => {
    const updates = {
      status: 'picked_up' as const,
      pickupTime: new Date().toISOString(),
    };
    try {
      await queueUpdate(delivery.id, updates);
      triggerAlert('success', `Marked ${delivery.mealType} as Picked Up (In-Transit)!`);
    } catch (err: any) {
      console.error(err);
      triggerAlert('error', 'Pickup update failed: ' + err.message);
    }
  };

  // Mark as Delivered
  const handleDeliver = async (delivery: Delivery) => {
    const updates = {
      status: 'delivered' as const,
      deliveryTime: new Date().toISOString(),
    };
    try {
      await queueUpdate(delivery.id, updates);
      triggerAlert('success', `Awesome! ${delivery.mealType} marked as Delivered!`);
    } catch (err: any) {
      console.error(err);
      triggerAlert('error', 'Delivery update failed: ' + err.message);
    }
  };

  // Get Map Search Query URL
  const getMapUrl = (address: string) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  // Claimed/Assigned jobs (assigned to me, not yet delivered or cancelled)
  const myAssignedJobs = deliveries.filter(
    (d) => d.deliveryBoyId === riderUser.id && d.status !== 'delivered' && d.status !== 'cancelled'
  );

  // Available jobs (pending and unassigned)
  const availableJobs = deliveries.filter(
    (d) => d.status === 'pending' && d.deliveryBoyId === null
  );

  // Completed jobs (delivered by me)
  const myCompletedJobs = deliveries.filter(
    (d) => d.deliveryBoyId === riderUser.id && d.status === 'delivered'
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-12">
      {/* Mobile Top App Bar */}
      <header className="bg-slate-900 text-white py-4 px-4 sticky top-0 z-30 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-emerald-600 p-1.5 rounded-lg text-white">
            <Truck className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight">Manjara Mane Aduge</h1>
            <span className="text-[10px] text-emerald-400 font-extrabold tracking-wider uppercase">Rider Dashboard</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Sync status indicator */}
          <div className="flex items-center">
            {pendingSyncCount > 0 ? (
              <button
                onClick={syncOfflineDeliveries}
                disabled={isSyncing}
                className="flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-1 rounded-full text-[10px] font-bold animate-pulse cursor-pointer"
                title="Click to manually upload unsynced changes to cloud"
              >
                <WifiOff className="h-3 w-3" />
                <span>{isSyncing ? "Syncing..." : `${pendingSyncCount} offline`}</span>
              </button>
            ) : navigator.onLine ? (
              <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-full text-[10px] font-bold">
                <Wifi className="h-3 w-3 text-emerald-400" />
                <span>Cloud Live</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-slate-800 text-slate-400 border border-slate-700 px-2 py-1 rounded-full text-[10px] font-bold">
                <WifiOff className="h-3 w-3 text-slate-500" />
                <span>Offline</span>
              </div>
            )}
          </div>

          <div className="text-right">
            <p className="text-xs font-bold text-slate-100">{riderUser.name}</p>
            <p className="text-[9px] text-slate-400">Rider ID: {riderUser.id.substring(0, 5)}</p>
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 bg-slate-800 rounded-lg text-slate-300 hover:text-white cursor-pointer"
            title="Log Out"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      </header>

      {/* Date Switcher Toggle */}
      <div className="bg-slate-200/60 p-1 mx-4 mt-4 rounded-xl flex gap-1">
        <button
          onClick={() => setDateMode('today')}
          className={`flex-1 py-2 text-center text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
            dateMode === 'today'
              ? 'bg-white text-emerald-700 shadow-sm font-black'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          📅 Today's Run
        </button>
        <button
          onClick={() => setDateMode('tomorrow')}
          className={`flex-1 py-2 text-center text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
            dateMode === 'tomorrow'
              ? 'bg-white text-emerald-700 shadow-sm font-black'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          ⏭️ Tomorrow's Run
        </button>
      </div>

      {/* Stats Summary Panel */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 mt-3 flex items-center justify-between text-xs font-semibold text-slate-500">
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4 text-emerald-600" />
          <span className="font-bold text-slate-700">Date: {new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold text-[10px]">
            {myCompletedJobs.length} Done
          </span>
          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold text-[10px]">
            {myAssignedJobs.filter(d => d.status === 'picked_up').length} Transit
          </span>
          {myAssignedJobs.filter(d => d.status === 'pending').length > 0 && (
            <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold text-[10px]">
              {myAssignedJobs.filter(d => d.status === 'pending').length} Claimed
            </span>
          )}
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="bg-white grid grid-cols-3 border-b border-slate-100 text-center sticky top-[57px] z-20 shadow-xs">
        <button
          onClick={() => setFilterTab('my_jobs')}
          className={`py-3.5 text-xs font-extrabold flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            filterTab === 'my_jobs'
              ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/20'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span>Claimed Jobs</span>
          <span className={`px-1.5 py-0.5 text-[9px] rounded-full font-black ${
            myAssignedJobs.length > 0 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
          }`}>
            {myAssignedJobs.length}
          </span>
        </button>

        <button
          onClick={() => setFilterTab('available')}
          className={`py-3.5 text-xs font-extrabold flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            filterTab === 'available'
              ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/20'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span>Available Runs</span>
          <span className={`px-1.5 py-0.5 text-[9px] rounded-full font-black ${
            availableJobs.length > 0 ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
          }`}>
            {availableJobs.length}
          </span>
        </button>

        <button
          onClick={() => setFilterTab('completed')}
          className={`py-3.5 text-xs font-extrabold flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            filterTab === 'completed'
              ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/20'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span>Completed</span>
          <span className="px-1.5 py-0.5 text-[9px] rounded-full bg-green-100 text-green-700 font-black">
            {myCompletedJobs.length}
          </span>
        </button>
      </div>

      {/* Alerts */}
      {alertMsg.text && (
        <div className="p-3 mx-4 mt-3 rounded-lg bg-slate-900 text-white text-xs font-medium shadow-md flex items-center gap-2">
          <Check className="h-4 w-4 text-green-400" />
          {alertMsg.text}
        </div>
      )}

      {/* Main Jobs Listing */}
      <main className="p-4 flex-1">
        {filterTab === 'my_jobs' && (
          <div className="space-y-4">
            {myAssignedJobs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400 shadow-sm mt-6">
                <Truck className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-sm text-slate-800">No active claimed orders</p>
                <p className="text-xs text-slate-500 mt-1">Please select the 'Available Runs' tab to claim and start delivering fresh meals!</p>
              </div>
            ) : (
              myAssignedJobs.map((delivery) => (
                <motion.div
                  key={delivery.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`bg-white rounded-2xl border border-l-4 border-slate-100 shadow-md p-5 space-y-4 ${
                    delivery.status === 'pending' ? 'border-l-amber-500' : 'border-l-emerald-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        delivery.mealType === 'breakfast' ? 'bg-amber-100 text-amber-800' :
                        delivery.mealType === 'lunch' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {delivery.mealType}
                      </span>
                      <h4 className="font-extrabold text-slate-800 text-base mt-1.5">{delivery.customerName}</h4>
                      <p className="text-xs text-slate-500 font-semibold mt-0.5">Quantity: {delivery.membersCount} Box(es)</p>
                    </div>
 
                    <div className="text-right text-xs text-slate-400 space-y-1">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                        delivery.status === 'pending' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'
                      }`}>
                        {delivery.status === 'pending' ? 'Claimed' : 'In-Transit'}
                      </span>
                    </div>
                  </div>
 
                  {/* Contact details */}
                  <div className="bg-slate-50/50 p-3 rounded-xl space-y-2 text-xs text-slate-600 border border-slate-100">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      <span className="font-semibold">{delivery.customerAddress}</span>
                    </div>
                    {delivery.notes && (
                      <div className="flex items-center gap-2.5 text-amber-800 bg-amber-50 p-2 rounded-lg text-[11px] font-medium border border-amber-100">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>Inst: "{delivery.notes}"</span>
                      </div>
                    )}
                  </div>
 
                  {/* Rider quick action panel */}
                  <div className="grid grid-cols-2 gap-3.5 pt-1">
                    <a
                      href={`tel:${delivery.customerPhone}`}
                      className="flex items-center justify-center gap-2.5 py-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition-colors"
                    >
                      <Phone className="h-4 w-4 text-emerald-600" />
                      Call Customer
                    </a>
                    <a
                      href={getMapUrl(delivery.customerAddress)}
                      target="_blank"
                      rel="referrer"
                      className="flex items-center justify-center gap-2.5 py-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition-colors"
                    >
                      <Navigation className="h-4 w-4 text-blue-500" />
                      Navigate Map
                    </a>
                  </div>
 
                  {delivery.status === 'pending' ? (
                    <div className="space-y-2.5">
                      <button
                        onClick={() => handlePickUp(delivery)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-xl text-sm transition-colors cursor-pointer shadow-md shadow-emerald-500/10 flex items-center justify-center gap-2"
                      >
                        <Truck className="h-5 w-5" />
                        Start Delivery Run (Picked Up)
                      </button>
                      <button
                        onClick={() => handleUnclaimJob(delivery)}
                        className="w-full text-xs font-bold text-slate-400 hover:text-red-500 py-1 transition-colors cursor-pointer text-center"
                      >
                        ↩️ Unclaim / Return to Pool
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleDeliver(delivery)}
                      className="w-full bg-green-500 hover:bg-green-600 text-white font-extrabold py-3.5 rounded-xl text-sm transition-colors cursor-pointer shadow-md shadow-green-500/10 flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="h-5 w-5" />
                      Mark as Delivered
                    </button>
                  )}
                </motion.div>
              ))
            )}
          </div>
        )}

        {filterTab === 'available' && (
          <div className="space-y-4">
            {availableJobs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400 shadow-sm mt-6">
                <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-2 animate-bounce" />
                <p className="font-bold text-sm text-slate-800">All caught up!</p>
                <p className="text-xs text-slate-500 mt-1">No unassigned deliveries waiting. Check back soon when admin schedules more dispatch runs!</p>
              </div>
            ) : (
              availableJobs.map((delivery) => (
                <motion.div
                  key={delivery.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        delivery.mealType === 'breakfast' ? 'bg-amber-100 text-amber-800' :
                        delivery.mealType === 'lunch' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {delivery.mealType}
                      </span>
                      <h4 className="font-extrabold text-slate-800 text-base mt-1.5">{delivery.customerName}</h4>
                      <p className="text-xs text-slate-500 font-semibold mt-0.5">Quantity: {delivery.membersCount} Box(es)</p>
                    </div>

                    <span className="bg-blue-50 text-blue-800 px-2.5 py-1 rounded-full text-[9px] font-black">
                      Pick-up Pending
                    </span>
                  </div>

                  <div className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                    <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    <span>{delivery.customerAddress}</span>
                  </div>

                  <button
                    onClick={() => handleClaimJob(delivery)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-xl text-sm cursor-pointer transition-colors flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/15"
                  >
                    <Truck className="h-4.5 w-4.5" />
                    Claim & Assign to Me
                  </button>
                </motion.div>
              ))
            )}
          </div>
        )}

        {filterTab === 'completed' && (
          <div className="space-y-4">
            {myCompletedJobs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-slate-400 shadow-sm mt-6">
                <Check className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-sm text-slate-800">No completed jobs yet</p>
                <p className="text-xs text-slate-500 mt-1">Completed orders will appear here so you can keep track of your daily stats!</p>
              </div>
            ) : (
              myCompletedJobs.map((delivery) => (
                <div
                  key={delivery.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-2 opacity-85"
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      delivery.mealType === 'breakfast' ? 'bg-amber-100 text-amber-800' :
                      delivery.mealType === 'lunch' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {delivery.mealType}
                    </span>
                    <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" /> Delivered
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-800 text-sm">{delivery.customerName}</h4>
                  <div className="flex justify-between items-center text-xs text-slate-400 pt-1 border-t border-slate-50">
                    <span>{delivery.membersCount} Box(es)</span>
                    <span>Time: {delivery.deliveryTime ? new Date(delivery.deliveryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
