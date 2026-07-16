import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { Customer, Delivery, Bill, UserProfile } from '../types';
import { motion } from 'motion/react';
import {
  Users,
  Utensils,
  Plus,
  Search,
  FileText,
  Calendar,
  DollarSign,
  MapPin,
  Phone,
  UserCheck,
  RefreshCw,
  Clock,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  TrendingUp,
  ChevronRight,
  LogOut,
  IndianRupee,
  Activity,
  Download,
  Printer,
  Eye,
  RotateCcw
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface AdminDashboardProps {
  adminUser: { id: string; name: string };
  onLogout: () => void;
}

export default function AdminDashboard({ adminUser, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'deliveries' | 'customers' | 'billing' | 'riders' | 'users'>('deliveries');

  // Real-time state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [riders, setRiders] = useState<UserProfile[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [viewingInvoice, setViewingInvoice] = useState<Bill | null>(null);

  // Filter states
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryMealFilter, setDeliveryMealFilter] = useState<'all' | 'breakfast' | 'lunch' | 'dinner'>('all');
  const [deliveryRiderFilter, setDeliveryRiderFilter] = useState<string>('all');
  const [customerSearch, setCustomerSearch] = useState('');

  // Modals / Form states
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custMembers, setCustMembers] = useState(1);
  const [custPlans, setCustPlans] = useState({ breakfast: true, lunch: true, dinner: true });
  const [custBreakfastRate, setCustBreakfastRate] = useState(50);
  const [custLunchRate, setCustLunchRate] = useState(80);
  const [custDinnerRate, setCustDinnerRate] = useState(80);
  const [custNotes, setCustNotes] = useState('');

  // User Management States
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userUsername, setUserUsername] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<'admin' | 'delivery'>('delivery');
  const [userStatus, setUserStatus] = useState<'active' | 'inactive'>('active');

  // Billing Generator States
  const [billingCustId, setBillingCustId] = useState('');
  const [billingStartDate, setBillingStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Default to start of month
    return d.toISOString().split('T')[0];
  });
  const [billingEndDate, setBillingEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [generatedBillPreview, setGeneratedBillPreview] = useState<{
    customer: Customer;
    breakfastCount: number;
    lunchCount: number;
    dinnerCount: number;
    totalAmount: number;
    deliveriesList: Delivery[];
  } | null>(null);

  // Ad-hoc and Single-Delivery Customization States
  const [isAdHocModalOpen, setIsAdHocModalOpen] = useState(false);
  const [adHocCustId, setAdHocCustId] = useState('');
  const [adHocMealType, setAdHocMealType] = useState<'breakfast' | 'lunch' | 'dinner'>('lunch');
  const [adHocDate, setAdHocDate] = useState(deliveryDate);
  const [adHocBoxes, setAdHocBoxes] = useState(1);
  const [adHocNotes, setAdHocNotes] = useState('');

  const [isEditingDelivery, setIsEditingDelivery] = useState<Delivery | null>(null);
  const [editDeliveryBoxes, setEditDeliveryBoxes] = useState(1);
  const [editDeliveryNotes, setEditDeliveryNotes] = useState('');

  // Reset confirmation state
  const [resetConfirmText, setResetConfirmText] = useState('');

  // Status logs and spinner triggers
  const [actionLoading, setActionLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState({ type: 'success', text: '' });

  // Set alert utility
  const triggerAlert = (type: 'success' | 'error', text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg({ type: 'success', text: '' }), 4000);
  };

  // Real-time listener hooks
  useEffect(() => {
    // 1. Subscribe to customers
    const unsubscribeCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const list: Customer[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Customer);
      });
      setCustomers(list.sort((a, b) => a.name.localeCompare(b.name)));
    }, (error) => console.error("Customers subscription error:", error));

    // 2. Subscribe to deliveries (for today / date range)
    const unsubscribeDeliveries = onSnapshot(collection(db, 'deliveries'), (snapshot) => {
      const list: Delivery[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Delivery);
      });
      setDeliveries(list);
    }, (error) => console.error("Deliveries subscription error:", error));

    // 3. Subscribe to riders (users with role 'delivery')
    const qRiders = query(collection(db, 'users'), where('role', '==', 'delivery'));
    const unsubscribeRiders = onSnapshot(qRiders, (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as UserProfile);
      });
      setRiders(list);
    }, (error) => console.error("Riders subscription error:", error));

    // 4. Subscribe to bills
    const unsubscribeBills = onSnapshot(collection(db, 'billing'), (snapshot) => {
      const list: Bill[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Bill);
      });
      setBills(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }, (error) => console.error("Bills subscription error:", error));

    // 5. Subscribe to all users (admins + riders)
    const unsubscribeAllUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as UserProfile);
      });
      setAllUsers(list.sort((a, b) => a.name.localeCompare(b.name)));
    }, (error) => console.error("All users subscription error:", error));

    return () => {
      unsubscribeCustomers();
      unsubscribeDeliveries();
      unsubscribeRiders();
      unsubscribeBills();
      unsubscribeAllUsers();
    };
  }, []);

  // Generate deliveries for the selected date
  const handleGenerateDeliveries = async () => {
    setActionLoading(true);
    let createdCount = 0;
    try {
      // For each customer, check active plans and create deliveries if not exists
      for (const customer of customers) {
        const mealTypes: ('breakfast' | 'lunch' | 'dinner')[] = [];
        if (customer.activePlans.breakfast) mealTypes.push('breakfast');
        if (customer.activePlans.lunch) mealTypes.push('lunch');
        if (customer.activePlans.dinner) mealTypes.push('dinner');

        for (const mealType of mealTypes) {
          const docId = `${customer.id}_${deliveryDate}_${mealType}`;
          // Check if this delivery already exists in state to avoid redundant writes
          const exists = deliveries.some((d) => d.id === docId);

          if (!exists) {
            const newDelivery: Delivery = {
              id: docId,
              date: deliveryDate,
              mealType,
              customerId: customer.id,
              customerName: customer.name,
              customerAddress: customer.address,
              customerPhone: customer.phone,
              membersCount: customer.members,
              deliveryBoyId: null,
              deliveryBoyName: null,
              status: 'pending',
              pickupTime: null,
              deliveryTime: null,
              notes: '',
            };
            await setDoc(doc(db, 'deliveries', docId), newDelivery);
            createdCount++;
          }
        }
      }
      triggerAlert('success', `Generated ${createdCount} new deliveries for ${deliveryDate}.`);
    } catch (err: any) {
      console.error(err);
      triggerAlert('error', 'Failed to generate deliveries: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Assign delivery boy to a delivery doc
  const handleAssignRider = async (deliveryId: string, riderId: string) => {
    try {
      if (riderId === 'unassigned') {
        await updateDoc(doc(db, 'deliveries', deliveryId), {
          deliveryBoyId: null,
          deliveryBoyName: null,
        });
        triggerAlert('success', 'Rider unassigned successfully.');
        return;
      }

      const rider = riders.find((r) => r.id === riderId);
      if (rider) {
        await updateDoc(doc(db, 'deliveries', deliveryId), {
          deliveryBoyId: rider.id,
          deliveryBoyName: rider.name,
        });
        triggerAlert('success', `Assigned to ${rider.name}.`);
      }
    } catch (err: any) {
      console.error(err);
      triggerAlert('error', 'Assignment failed: ' + err.message);
    }
  };

  // Update delivery status manually (for Admin override)
  const handleUpdateStatus = async (deliveryId: string, status: 'pending' | 'picked_up' | 'delivered' | 'cancelled') => {
    try {
      const nowStr = new Date().toISOString();
      const updates: any = { status };
      if (status === 'picked_up') {
        updates.pickupTime = nowStr;
      } else if (status === 'delivered') {
        updates.deliveryTime = nowStr;
      } else if (status === 'pending') {
        updates.pickupTime = null;
        updates.deliveryTime = null;
      }
      await updateDoc(doc(db, 'deliveries', deliveryId), updates);
      triggerAlert('success', `Status updated to ${status}.`);
    } catch (err: any) {
      console.error(err);
      triggerAlert('error', 'Status update failed: ' + err.message);
    }
  };

  // Save or edit Customer
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const id = editingCustomer ? editingCustomer.id : `cust_${Date.now()}`;
      const data: Customer = {
        id,
        name: custName,
        phone: custPhone,
        address: custAddress,
        members: Number(custMembers),
        activePlans: custPlans,
        breakfastRate: Number(custBreakfastRate),
        lunchRate: Number(custLunchRate),
        dinnerRate: Number(custDinnerRate),
        createdAt: editingCustomer ? editingCustomer.createdAt : new Date().toISOString(),
        notes: custNotes,
      };

      await setDoc(doc(db, 'customers', id), data);
      setIsCustomerModalOpen(false);
      setEditingCustomer(null);
      resetCustomerForm();
      triggerAlert('success', editingCustomer ? 'Customer updated successfully!' : 'Customer added successfully!');
    } catch (err: any) {
      console.error(err);
      triggerAlert('error', 'Failed to save customer: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Customer
  const handleDeleteCustomer = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this customer? This will not delete their historical deliveries.')) return;
    try {
      await deleteDoc(doc(db, 'customers', id));
      triggerAlert('success', 'Customer deleted successfully.');
    } catch (err: any) {
      console.error(err);
      triggerAlert('error', 'Delete failed: ' + err.message);
    }
  };

  // Open modal for editing a user/admin
  const openEditUserModal = (user: UserProfile) => {
    setEditingUser(user);
    setUserName(user.name);
    setUserPhone(user.phone);
    setUserEmail(user.email);
    setUserUsername(user.username || user.email.split('@')[0]);
    setUserPassword(user.password || 'Password@123');
    setUserRole(user.role);
    setUserStatus(user.status);
    setIsUserModalOpen(true);
  };

  // Open modal for creating a new user/admin
  const openCreateUserModal = () => {
    setEditingUser(null);
    setUserName('');
    setUserPhone('');
    setUserEmail('');
    setUserUsername('');
    setUserPassword('');
    setUserRole('delivery');
    setUserStatus('active');
    setIsUserModalOpen(true);
  };

  // Save or update user (Admin / Delivery Boy)
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || !userPhone || !userEmail || !userPassword) {
      triggerAlert('error', 'Please fill in all required fields.');
      return;
    }
    if (userPassword.length < 6) {
      triggerAlert('error', 'Password must be at least 6 characters.');
      return;
    }
    setActionLoading(true);
    try {
      const emailVal = userEmail.trim();
      const usernameVal = userUsername.trim() || emailVal.split('@')[0];

      if (editingUser) {
        // Update existing user/admin
        const docRef = doc(db, 'users', editingUser.id);
        await updateDoc(docRef, {
          name: userName.trim(),
          email: emailVal,
          username: usernameVal,
          phone: userPhone.trim(),
          role: userRole,
          status: userStatus,
          password: userPassword,
        });
        triggerAlert('success', `User ${userName} updated successfully!`);
      } else {
        // Create new user/admin (Admin can add any new admins if required)
        const newDocRef = doc(collection(db, 'users'));
        const uid = newDocRef.id;
        await setDoc(newDocRef, {
          id: uid,
          name: userName.trim(),
          email: emailVal,
          username: usernameVal,
          phone: userPhone.trim(),
          role: userRole,
          status: userStatus,
          password: userPassword,
          createdAt: new Date().toISOString(),
        });
        triggerAlert('success', `User ${userName} registered successfully!`);
      }
      setIsUserModalOpen(false);
    } catch (err: any) {
      console.error(err);
      triggerAlert('error', 'Failed to save user: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete User Profile
  const handleDeleteUser = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete user ${name}? This will clear their credentials.`)) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      triggerAlert('success', `User ${name} deleted successfully.`);
    } catch (err: any) {
      console.error(err);
      triggerAlert('error', 'Failed to delete user: ' + err.message);
    }
  };

  // Reset Deliveries for Today
  const handleResetDeliveriesToday = async () => {
    const todayDeliveries = deliveries.filter((d) => d.date === deliveryDate);
    if (todayDeliveries.length === 0) {
      triggerAlert('error', `No deliveries found for ${deliveryDate} to reset.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete all ${todayDeliveries.length} deliveries for ${deliveryDate}? This action cannot be undone.`)) {
      return;
    }
    setActionLoading(true);
    try {
      let count = 0;
      await Promise.all(
        todayDeliveries.map(async (d) => {
          await deleteDoc(doc(db, 'deliveries', d.id));
          count++;
        })
      );
      triggerAlert('success', `Successfully deleted all ${count} deliveries for ${deliveryDate}.`);
    } catch (err: any) {
      console.error("Error resetting deliveries:", err);
      triggerAlert('error', `Failed to reset deliveries: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Clear Billing Logs & Invoices
  const handleResetAllBilling = async () => {
    if (bills.length === 0) {
      triggerAlert('error', 'No billing records found to clear.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ALL ${bills.length} billing invoices from the system? This action is irreversible.`)) {
      return;
    }
    setActionLoading(true);
    try {
      let count = 0;
      await Promise.all(
        bills.map(async (b) => {
          await deleteDoc(doc(db, 'billing', b.id));
          count++;
        })
      );
      triggerAlert('success', `Successfully cleared all ${count} billing records.`);
    } catch (err: any) {
      console.error("Error clearing bills:", err);
      triggerAlert('error', `Failed to clear billing: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Factory Reset Database (Wipe Everything Except Current Admin)
  const handleFactoryReset = async () => {
    if (resetConfirmText.toUpperCase() !== 'RESET') {
      triggerAlert('error', 'Please type the word "RESET" exactly to confirm system wipe.');
      return;
    }
    if (!window.confirm(`CRITICAL WARNING: This will delete ALL customers, ALL deliveries, ALL bills, and ALL user accounts except your own. Are you absolutely certain you want to proceed?`)) {
      return;
    }
    setActionLoading(true);
    try {
      // 1. Delete all customers
      await Promise.all(customers.map((c) => deleteDoc(doc(db, 'customers', c.id))));
      
      // 2. Delete all deliveries
      await Promise.all(deliveries.map((d) => deleteDoc(doc(db, 'deliveries', d.id))));
      
      // 3. Delete all bills
      await Promise.all(bills.map((b) => deleteDoc(doc(db, 'billing', b.id))));
      
      // 4. Delete all other users
      const usersToDelete = allUsers.filter((u) => u.id !== adminUser.id);
      await Promise.all(usersToDelete.map((u) => deleteDoc(doc(db, 'users', u.id))));
      
      setResetConfirmText('');
      triggerAlert('success', 'Factory Reset completed! All transaction history, customer rosters, and secondary accounts have been purged. Your administrator login remains active.');
    } catch (err: any) {
      console.error("Error during factory reset:", err);
      triggerAlert('error', `Failed to perform factory reset: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Add a single custom one-off / ad-hoc delivery for a customer on a specific date
  const handleSaveAdHocDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adHocCustId) {
      triggerAlert('error', 'Please select a customer first.');
      return;
    }
    const customer = customers.find(c => c.id === adHocCustId);
    if (!customer) {
      triggerAlert('error', 'Customer not found.');
      return;
    }

    setActionLoading(true);
    try {
      const docId = `${customer.id}_${adHocDate}_${adHocMealType}_adhoc_${Date.now()}`;
      const newDelivery: Delivery = {
        id: docId,
        date: adHocDate,
        mealType: adHocMealType,
        customerId: customer.id,
        customerName: customer.name,
        customerAddress: customer.address,
        customerPhone: customer.phone,
        membersCount: Number(adHocBoxes),
        deliveryBoyId: null,
        deliveryBoyName: null,
        status: 'pending',
        pickupTime: null,
        deliveryTime: null,
        notes: adHocNotes.trim(),
      };

      await setDoc(doc(db, 'deliveries', docId), newDelivery);
      triggerAlert('success', `Successfully scheduled custom ${adHocMealType} run for ${customer.name}!`);
      setIsAdHocModalOpen(false);
      setAdHocNotes('');
    } catch (err: any) {
      console.error(err);
      triggerAlert('error', 'Failed to schedule ad-hoc run: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Open inline / modal editor for individual delivery instances
  const handleOpenEditDeliveryModal = (delivery: Delivery) => {
    setIsEditingDelivery(delivery);
    setEditDeliveryBoxes(delivery.membersCount);
    setEditDeliveryNotes(delivery.notes || '');
  };

  // Save changes to a single delivery instance (boxes count, instructions)
  const handleSaveEditedDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditingDelivery) return;

    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'deliveries', isEditingDelivery.id), {
        membersCount: Number(editDeliveryBoxes),
        notes: editDeliveryNotes.trim()
      });
      triggerAlert('success', 'Delivery instance details updated successfully!');
      setIsEditingDelivery(null);
    } catch (err: any) {
      console.error(err);
      triggerAlert('error', 'Failed to update delivery instance: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Completely delete a delivery instance
  const handleDeleteDeliveryInstance = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to completely remove this delivery instance for ${name}?`)) return;
    try {
      await deleteDoc(doc(db, 'deliveries', id));
      triggerAlert('success', 'Delivery instance removed successfully.');
    } catch (err: any) {
      console.error(err);
      triggerAlert('error', 'Failed to remove delivery instance: ' + err.message);
    }
  };

  // CSV Export Utility Helpers
  const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = [
      headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
      ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Excel UTF-8 BOM \uFEFF to preserve symbols
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportCustomersToCSV = () => {
    const headers = ['ID', 'Customer Name', 'Phone', 'Delivery Address', 'Boxes Count', 'Breakfast Subscribed', 'Lunch Subscribed', 'Dinner Subscribed', 'Breakfast Rate (₹)', 'Lunch Rate (₹)', 'Dinner Rate (₹)', 'Subscription Date'];
    const rows = customers.map(c => [
      c.id,
      c.name,
      c.phone,
      c.address,
      c.members,
      c.activePlans.breakfast ? 'YES' : 'NO',
      c.activePlans.lunch ? 'YES' : 'NO',
      c.activePlans.dinner ? 'YES' : 'NO',
      c.breakfastRate,
      c.lunchRate,
      c.dinnerRate,
      new Date(c.createdAt).toLocaleDateString()
    ]);
    downloadCSV('Catering_Subscriptions_Master.csv', headers, rows);
    triggerAlert('success', 'Master Subscription list exported to CSV/Excel!');
  };

  const exportDeliveriesToCSV = () => {
    const headers = ['Delivery ID', 'Date', 'Customer Name', 'Contact Phone', 'Delivery Address', 'Meal Type', 'Boxes', 'Assigned Rider', 'Status', 'Pickup Time', 'Delivered At'];
    const rows = displayedDeliveries.map(d => [
      d.id,
      d.date,
      d.customerName,
      d.customerPhone,
      d.customerAddress,
      d.mealType,
      d.membersCount,
      d.deliveryBoyName || 'Unassigned',
      d.status.toUpperCase(),
      d.pickupTime ? new Date(d.pickupTime).toLocaleTimeString() : 'N/A',
      d.deliveryTime ? new Date(d.deliveryTime).toLocaleTimeString() : 'N/A'
    ]);
    downloadCSV(`Delivery_Log_${deliveryDate}.csv`, headers, rows);
    triggerAlert('success', `Deliveries log for ${deliveryDate} exported to CSV/Excel!`);
  };

  const exportBillsToCSV = () => {
    const headers = ['Invoice ID', 'Customer Name', 'Billing Start Date', 'Billing End Date', 'Breakfasts Count', 'Lunches Count', 'Dinners Count', 'Breakfast Rate (₹)', 'Lunch Rate (₹)', 'Dinner Rate (₹)', 'Total Amount (₹)', 'Status', 'Issued Date'];
    const rows = bills.map(b => [
      b.id,
      b.customerName,
      b.startDate,
      b.endDate,
      b.breakfastCount,
      b.lunchCount,
      b.dinnerCount,
      b.breakfastRate,
      b.lunchRate,
      b.dinnerRate,
      b.totalAmount,
      b.status.toUpperCase(),
      new Date(b.createdAt).toLocaleDateString()
    ]);
    downloadCSV('Invoice_Ledger_History.csv', headers, rows);
    triggerAlert('success', 'Full Invoice dispatch ledger exported to CSV/Excel!');
  };

  const handlePrintWindow = () => {
    window.print();
  };

  const openEditCustomerModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustName(customer.name);
    setCustPhone(customer.phone);
    setCustAddress(customer.address);
    setCustMembers(customer.members);
    setCustPlans(customer.activePlans);
    setCustBreakfastRate(customer.breakfastRate);
    setCustLunchRate(customer.lunchRate);
    setCustDinnerRate(customer.dinnerRate);
    setCustNotes(customer.notes || '');
    setIsCustomerModalOpen(true);
  };

  const resetCustomerForm = () => {
    setCustName('');
    setCustPhone('');
    setCustAddress('');
    setCustMembers(1);
    setCustPlans({ breakfast: true, lunch: true, dinner: true });
    setCustBreakfastRate(50);
    setCustLunchRate(80);
    setCustDinnerRate(80);
    setCustNotes('');
    setEditingCustomer(null);
  };

  // Calculate & Preview Bill
  const handleCalculateBill = () => {
    if (!billingCustId) {
      triggerAlert('error', 'Please select a customer first.');
      return;
    }
    const customer = customers.find((c) => c.id === billingCustId);
    if (!customer) return;

    // Filter deliveries: matching customer, between dates, and successfully delivered
    const filtered = deliveries.filter((d) => {
      return (
        d.customerId === billingCustId &&
        d.date >= billingStartDate &&
        d.date <= billingEndDate &&
        d.status === 'delivered'
      );
    });

    const breakfastCount = filtered.filter((d) => d.mealType === 'breakfast').reduce((acc, curr) => acc + curr.membersCount, 0);
    const lunchCount = filtered.filter((d) => d.mealType === 'lunch').reduce((acc, curr) => acc + curr.membersCount, 0);
    const dinnerCount = filtered.filter((d) => d.mealType === 'dinner').reduce((acc, curr) => acc + curr.membersCount, 0);

    const totalAmount =
      breakfastCount * customer.breakfastRate +
      lunchCount * customer.lunchRate +
      dinnerCount * customer.dinnerRate;

    setGeneratedBillPreview({
      customer,
      breakfastCount,
      lunchCount,
      dinnerCount,
      totalAmount,
      deliveriesList: filtered,
    });
  };

  // Save generated bill
  const handleSaveBill = async () => {
    if (!generatedBillPreview) return;
    setActionLoading(true);
    try {
      const billId = `bill_${Date.now()}`;
      const newBill: Bill = {
        id: billId,
        customerId: generatedBillPreview.customer.id,
        customerName: generatedBillPreview.customer.name,
        startDate: billingStartDate,
        endDate: billingEndDate,
        breakfastCount: generatedBillPreview.breakfastCount,
        lunchCount: generatedBillPreview.lunchCount,
        dinnerCount: generatedBillPreview.dinnerCount,
        breakfastRate: generatedBillPreview.customer.breakfastRate,
        lunchRate: generatedBillPreview.customer.lunchRate,
        dinnerRate: generatedBillPreview.customer.dinnerRate,
        totalAmount: generatedBillPreview.totalAmount,
        status: 'unpaid',
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'billing', billId), newBill);
      setGeneratedBillPreview(null);
      triggerAlert('success', `Bill generated successfully for ${newBill.customerName}!`);
    } catch (err: any) {
      console.error(err);
      triggerAlert('error', 'Bill generation failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Mark Bill as Paid
  const handleMarkBillPaid = async (billId: string) => {
    try {
      await updateDoc(doc(db, 'billing', billId), {
        status: 'paid',
        paidAt: new Date().toISOString(),
      });
      triggerAlert('success', 'Bill marked as Paid!');
    } catch (err: any) {
      console.error(err);
      triggerAlert('error', 'Failed to update bill: ' + err.message);
    }
  };

  // Delete Bill
  const handleDeleteBill = async (billId: string) => {
    if (!window.confirm('Delete this bill? This will not affect delivery logs.')) return;
    try {
      await deleteDoc(doc(db, 'billing', billId));
      triggerAlert('success', 'Bill deleted.');
    } catch (err: any) {
      console.error(err);
      triggerAlert('error', 'Failed to delete: ' + err.message);
    }
  };

  // Calculate Deliveries Stats for Charts & Cards
  const activeDeliveries = deliveries.filter((d) => d.date === deliveryDate);
  const totalMeals = activeDeliveries.reduce((sum, d) => sum + d.membersCount, 0);
  const pendingCount = activeDeliveries.filter((d) => d.status === 'pending').length;
  const transitCount = activeDeliveries.filter((d) => d.status === 'picked_up').length;
  const deliveredCount = activeDeliveries.filter((d) => d.status === 'delivered').length;
  const cancelledCount = activeDeliveries.filter((d) => d.status === 'cancelled').length;

  const deliveredPercentage = activeDeliveries.length > 0
    ? Math.round((activeDeliveries.filter((d) => d.status === 'delivered').length / activeDeliveries.length) * 100)
    : 0;

  // Filtered deliveries list for view
  const displayedDeliveries = activeDeliveries.filter((d) => {
    const matchMeal = deliveryMealFilter === 'all' || d.mealType === deliveryMealFilter;
    const matchRider = deliveryRiderFilter === 'all' || d.deliveryBoyId === deliveryRiderFilter;
    return matchMeal && matchRider;
  });

  // Riders summary calculating daily completed tasks
  const riderCompletedCount = (riderId: string) => {
    return deliveries.filter((d) => d.date === deliveryDate && d.deliveryBoyId === riderId && d.status === 'delivered').length;
  };
  const riderPendingCount = (riderId: string) => {
    return deliveries.filter((d) => d.date === deliveryDate && d.deliveryBoyId === riderId && (d.status === 'pending' || d.status === 'picked_up')).length;
  };

  // Charts Config
  const mealTypeData = [
    { name: 'Breakfast', value: activeDeliveries.filter((d) => d.mealType === 'breakfast').length },
    { name: 'Lunch', value: activeDeliveries.filter((d) => d.mealType === 'lunch').length },
    { name: 'Dinner', value: activeDeliveries.filter((d) => d.mealType === 'dinner').length },
  ];

  const statusData = [
    { name: 'Pending', count: pendingCount, fill: '#ef4444' },
    { name: 'In Transit', count: transitCount, fill: '#3b82f6' },
    { name: 'Delivered', count: deliveredCount, fill: '#22c55e' },
    { name: 'Cancelled', count: cancelledCount, fill: '#64748b' },
  ];

  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6'];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex-shrink-0 flex flex-col justify-between hidden md:flex">
        <div>
          <div className="p-4 border-b border-slate-800 flex flex-col items-center gap-2">
            <div className="w-40 max-w-full">
              <img src="/logo.svg" alt="Manjara Mane Aduge" className="w-full h-auto drop-shadow-md" referrerPolicy="no-referrer" />
            </div>
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">Administration Panel</span>
          </div>

          <div className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab('deliveries')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'deliveries' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/10' : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <Clock className="h-5 w-5" />
              Live Deliveries
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'customers' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/10' : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <Users className="h-5 w-5" />
              Customers
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'billing' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/10' : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <FileText className="h-5 w-5" />
              Billing Ledger
            </button>
            <button
              onClick={() => setActiveTab('riders')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'riders' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/10' : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <Activity className="h-5 w-5" />
              Rider Status
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'users' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/10' : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <UserCheck className="h-5 w-5" />
              Manage Team
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 mb-4">
            <div className="bg-slate-800 h-9 w-9 rounded-full flex items-center justify-center font-bold text-emerald-500 font-mono">
              {adminUser.name[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{adminUser.name}</p>
              <p className="text-xs text-slate-500 truncate">System Admin</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-slate-800 hover:border-slate-700 rounded-xl text-sm font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header (Mobile menu & live clock) */}
        <header className="bg-white border-b border-slate-100 py-4 px-6 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4 md:gap-0">
            {/* Mobile Title */}
            <div className="md:hidden flex items-center gap-2">
              <div className="w-36 max-w-full">
                <img src="/logo.svg" alt="Manjara Mane Aduge" className="w-full h-auto" referrerPolicy="no-referrer" />
              </div>
            </div>
            <div className="hidden md:block">
              <h2 className="text-xl font-bold text-slate-800">
                {activeTab === 'deliveries' && 'Delivery Dispatch & Tracking'}
                {activeTab === 'customers' && 'Catering Subscriptions'}
                {activeTab === 'billing' && 'Billing Generation & Logs'}
                {activeTab === 'riders' && 'Delivery Team Tracking'}
                {activeTab === 'users' && 'Users & Administrators Management'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-600">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              Real-time Database Live
            </div>
            {/* Mobile Logout */}
            <button
              onClick={onLogout}
              className="md:hidden p-2 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden bg-slate-900 text-slate-400 grid grid-cols-5 border-b border-slate-800 text-center text-xs sticky top-[61px] z-10 font-semibold">
          <button
            onClick={() => setActiveTab('deliveries')}
            className={`py-3 ${activeTab === 'deliveries' ? 'text-emerald-500 border-b-2 border-emerald-500 bg-slate-800/40' : ''}`}
          >
            Deliveries
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`py-3 ${activeTab === 'customers' ? 'text-emerald-500 border-b-2 border-emerald-500 bg-slate-800/40' : ''}`}
          >
            Customers
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={`py-3 ${activeTab === 'billing' ? 'text-emerald-500 border-b-2 border-emerald-500 bg-slate-800/40' : ''}`}
          >
            Billing
          </button>
          <button
            onClick={() => setActiveTab('riders')}
            className={`py-3 ${activeTab === 'riders' ? 'text-emerald-500 border-b-2 border-emerald-500 bg-slate-800/40' : ''}`}
          >
            Riders
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 ${activeTab === 'users' ? 'text-emerald-500 border-b-2 border-emerald-500 bg-slate-800/40' : ''}`}
          >
            Team
          </button>
        </div>

        {/* Alert Notifications */}
        {alertMsg.text && (
          <div className={`p-4 mx-6 mt-6 rounded-xl border flex items-center gap-3 text-sm font-medium ${
            alertMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <span className={`h-2 w-2 rounded-full ${alertMsg.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></span>
            {alertMsg.text}
          </div>
        )}

        <main className="p-6">
          {/* ======================================= */}
          {/* live deliveries tab                     */}
          {/* ======================================= */}
          {activeTab === 'deliveries' && (
            <div className="space-y-6">
              {/* Daily Statistics Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400">Total Scheduled</p>
                    <h3 className="text-2xl font-bold text-slate-800 mt-1">{totalMeals} Meals</h3>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600">
                    <Utensils className="h-6 w-6" />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400">Delivered</p>
                    <h3 className="text-2xl font-bold text-green-600 mt-1">{deliveredCount} Meals</h3>
                  </div>
                  <div className="bg-green-50 p-3 rounded-xl text-green-500">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400">In Transit</p>
                    <h3 className="text-2xl font-bold text-blue-600 mt-1">{transitCount} Meals</h3>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-xl text-blue-500">
                    <Clock className="h-6 w-6" />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400">Delivery Rate</p>
                    <h3 className="text-2xl font-bold text-slate-800 mt-1">{deliveredPercentage}%</h3>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-xl text-purple-500">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                </div>
              </div>

              {/* Progress and Dispatch Controls */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Target Date</label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Quick Select</label>
                    <div className="flex gap-1 p-1 bg-slate-50 rounded-xl border border-slate-200/50">
                      <button
                        onClick={() => setDeliveryDate(new Date().toISOString().split('T')[0])}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                          deliveryDate === new Date().toISOString().split('T')[0]
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Today
                      </button>
                      <button
                        onClick={() => {
                          const tom = new Date();
                          tom.setDate(tom.getDate() + 1);
                          setDeliveryDate(tom.toISOString().split('T')[0]);
                        }}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                          deliveryDate === (() => {
                            const tom = new Date();
                            tom.setDate(tom.getDate() + 1);
                            return tom.toISOString().split('T')[0];
                          })()
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Tomorrow
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Meal Filter</label>
                    <select
                      value={deliveryMealFilter}
                      onChange={(e: any) => setDeliveryMealFilter(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option value="all">All Meals</option>
                      <option value="breakfast">Breakfast Only</option>
                      <option value="lunch">Lunch Only</option>
                      <option value="dinner">Dinner Only</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Rider Filter</label>
                    <select
                      value={deliveryRiderFilter}
                      onChange={(e) => setDeliveryRiderFilter(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option value="all">All Riders</option>
                      {riders.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-2 md:pt-0 self-end md:self-center flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      if (customers.length > 0) {
                        setAdHocCustId(customers[0].id);
                        setAdHocBoxes(customers[0].members || 1);
                      } else {
                        setAdHocCustId('');
                        setAdHocBoxes(1);
                      }
                      setAdHocDate(deliveryDate);
                      setIsAdHocModalOpen(true);
                    }}
                    className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Plus className="h-4 w-4 text-emerald-400" />
                    + Schedule Ad-Hoc Run
                  </button>
                  <button
                    onClick={handleGenerateDeliveries}
                    disabled={actionLoading || customers.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-emerald-500/10 flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4 animate-spin-slow" />
                    Auto-Generate Deliveries
                  </button>
                </div>
              </div>

              {/* Delivery logs list */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none">
                {/* Print Only Header */}
                <div className="hidden print:block p-6 border-b border-slate-200 bg-white text-slate-900">
                  <h1 className="text-2xl font-black tracking-tight text-emerald-800">MANJARA MANE ADUGE CATERERS</h1>
                  <p className="text-sm font-bold text-slate-500 mt-1">Daily Delivery Run Sheet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Date: {new Date(deliveryDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    &nbsp;|&nbsp; Total Scheduled runs: {displayedDeliveries.length} meals
                  </p>
                </div>

                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2 print:hidden">
                  <div className="flex items-center gap-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      Active Shipments ({displayedDeliveries.length})
                    </h3>
                    <div className="text-xs text-slate-400">
                      Showing delivery instances for {deliveryDate}
                    </div>
                  </div>
                  {displayedDeliveries.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={exportDeliveriesToCSV}
                        className="px-3 py-1.5 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 bg-white flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        title="Export current run list to Excel/CSV"
                      >
                        <Download className="h-3.5 w-3.5 text-emerald-600" />
                        Export Excel
                      </button>
                      <button
                        onClick={handlePrintWindow}
                        className="px-3 py-1.5 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 bg-white flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        title="Print delivery sheet or save as PDF"
                      >
                        <Printer className="h-3.5 w-3.5 text-emerald-600" />
                        Print PDF
                      </button>
                    </div>
                  )}
                </div>

                {displayedDeliveries.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <p className="font-medium">No deliveries scheduled or generated for this date.</p>
                    <p className="text-xs mt-1">Please click the 'Auto-Generate Deliveries' button above to generate today's runs based on active subscriptions!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 text-xs font-bold uppercase">
                          <th className="py-4 px-6">Customer / Location</th>
                          <th className="py-4 px-6">Meal Type</th>
                          <th className="py-4 px-6">Assigned Rider</th>
                          <th className="py-4 px-6">Status</th>
                          <th className="py-4 px-6">Timings</th>
                          <th className="py-4 px-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                        {displayedDeliveries.map((delivery) => (
                          <tr key={delivery.id} className="hover:bg-slate-50/20">
                            <td className="py-4 px-6 max-w-xs">
                              <div className="font-bold text-slate-800">{delivery.customerName}</div>
                              <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3 shrink-0 text-slate-300" />
                                <span className="truncate">{delivery.customerAddress}</span>
                              </div>
                              <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <Phone className="h-3 w-3 shrink-0 text-slate-300" />
                                <span>{delivery.customerPhone}</span>
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                                    delivery.mealType === 'breakfast' ? 'bg-amber-100 text-amber-800' :
                                    delivery.mealType === 'lunch' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                                  }`}>
                                    {delivery.mealType}
                                  </span>
                                  <span className="font-semibold text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                    <span>{delivery.membersCount} Box</span>
                                    <button
                                      onClick={() => handleOpenEditDeliveryModal(delivery)}
                                      className="text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer p-0.5"
                                      title="Edit box count / instructions"
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                  </span>
                                </div>
                                {delivery.notes && (
                                  <div className="text-[10px] leading-tight font-medium text-amber-700 bg-amber-50/70 border border-amber-100/50 px-2 py-1 rounded-lg max-w-xs mt-1">
                                    <strong className="text-[9px] uppercase tracking-wider text-amber-800 font-extrabold block">Chef Notes:</strong>
                                    {delivery.notes}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <select
                                value={delivery.deliveryBoyId || 'unassigned'}
                                onChange={(e) => handleAssignRider(delivery.id, e.target.value)}
                                className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-white"
                              >
                                <option value="unassigned">Claimable / Unassigned</option>
                                {riders.map((r) => (
                                  <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-4 px-6">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                                delivery.status === 'delivered' ? 'bg-green-100 text-green-800' :
                                delivery.status === 'picked_up' ? 'bg-blue-100 text-blue-800' :
                                delivery.status === 'cancelled' ? 'bg-slate-100 text-slate-600' : 'bg-red-100 text-red-800'
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${
                                  delivery.status === 'delivered' ? 'bg-green-500' :
                                  delivery.status === 'picked_up' ? 'bg-blue-500' :
                                  delivery.status === 'cancelled' ? 'bg-slate-500' : 'bg-red-500'
                                }`}></span>
                                {delivery.status === 'picked_up' ? 'Picked Up' : delivery.status}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-xs text-slate-400 space-y-0.5">
                              {delivery.pickupTime && (
                                <div>Pickup: {new Date(delivery.pickupTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                              )}
                              {delivery.deliveryTime && (
                                <div className="text-green-600 font-medium">Delivered: {new Date(delivery.deliveryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                              )}
                              {!delivery.pickupTime && !delivery.deliveryTime && <div>-</div>}
                            </td>
                            <td className="py-4 px-6 text-right space-x-1.5 print:hidden">
                              {/* Edit details */}
                              {delivery.status !== 'delivered' && (
                                <button
                                  onClick={() => handleOpenEditDeliveryModal(delivery)}
                                  className="p-1 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors inline-block cursor-pointer"
                                  title="Edit Boxes & Notes"
                                >
                                  <Edit2 className="h-4.5 w-4.5" />
                                </button>
                              )}

                              {/* Restore if Cancelled */}
                              {delivery.status === 'cancelled' && (
                                <button
                                  onClick={() => handleUpdateStatus(delivery.id, 'pending')}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors inline-block cursor-pointer"
                                  title="Restore / Re-activate Run"
                                >
                                  <RotateCcw className="h-4.5 w-4.5" />
                                </button>
                              )}

                              {/* Force Deliver */}
                              {delivery.status !== 'delivered' && delivery.status !== 'cancelled' && (
                                <button
                                  onClick={() => handleUpdateStatus(delivery.id, 'delivered')}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded-lg transition-colors inline-block cursor-pointer"
                                  title="Force Deliver"
                                >
                                  <CheckCircle className="h-4.5 w-4.5" />
                                </button>
                              )}

                              {/* Cancel/Skip Delivery */}
                              {delivery.status !== 'cancelled' && delivery.status !== 'delivered' && (
                                <button
                                  onClick={() => handleUpdateStatus(delivery.id, 'cancelled')}
                                  className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors inline-block cursor-pointer"
                                  title="Cancel / Skip Delivery"
                                >
                                  <XCircle className="h-4.5 w-4.5" />
                                </button>
                              )}

                              {/* Delete Completely */}
                              <button
                                onClick={() => handleDeleteDeliveryInstance(delivery.id, delivery.customerName)}
                                className="p-1 text-red-400 hover:bg-red-50 rounded-lg transition-colors inline-block cursor-pointer"
                                title="Delete Run Instance completely"
                              >
                                <Trash2 className="h-4.5 w-4.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================= */}
          {/* Customers tab                          */}
          {/* ======================================= */}
          {activeTab === 'customers' && (
            <div className="space-y-6">
              {/* Print Only Header */}
              <div className="hidden print:block p-6 border-b border-slate-200 bg-white text-slate-900 mb-6">
                <h1 className="text-2xl font-black tracking-tight text-emerald-800">MANJARA MANE ADUGE CATERERS</h1>
                <p className="text-sm font-bold text-slate-500 mt-1">Catering Subscriptions Directory</p>
                <p className="text-xs text-slate-400 mt-1">
                  Active subscriptions register &nbsp;|&nbsp; Total active accounts: {customers.length}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm print:hidden">
                {/* Search */}
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search customers by name, phone or address..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="pl-10 pr-4 py-2 block w-full border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                  {customers.length > 0 && (
                    <>
                      <button
                        onClick={exportCustomersToCSV}
                        className="px-3.5 py-2.5 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 bg-white flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        title="Export all customers to Excel CSV"
                      >
                        <Download className="h-4 w-4 text-emerald-600" />
                        Export Excel
                      </button>
                      <button
                        onClick={handlePrintWindow}
                        className="px-3.5 py-2.5 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 bg-white flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        title="Print subscriber cards or list"
                      >
                        <Printer className="h-4 w-4 text-emerald-600" />
                        Print PDF
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      resetCustomerForm();
                      setIsCustomerModalOpen(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-emerald-500/10 flex items-center gap-2 cursor-pointer transition-colors justify-center flex-1 sm:flex-initial"
                  >
                    <Plus className="h-5 w-5" />
                    Add New Customer
                  </button>
                </div>
              </div>

              {/* Customers list cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {customers
                  .filter((c) => {
                    const term = customerSearch.toLowerCase();
                    return (
                      c.name.toLowerCase().includes(term) ||
                      c.phone.includes(term) ||
                      c.address.toLowerCase().includes(term)
                    );
                  })
                  .map((customer) => (
                    <motion.div
                      layout
                      key={customer.id}
                      className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between"
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-slate-800 text-lg leading-snug">{customer.name}</h4>
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400 mt-1">
                              <Users className="h-3.5 w-3.5" /> {customer.members} Box per delivery
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-extrabold">
                            <IndianRupee className="h-3 w-3 shrink-0" />
                            {customer.lunchRate}/meal
                          </div>
                        </div>

                        {/* Contacts & Location */}
                        <div className="mt-5 space-y-2 text-xs text-slate-500 border-t border-b border-slate-100 py-3 my-3">
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-slate-300" />
                            <span>{customer.phone}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <MapPin className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                            <span className="line-clamp-2">{customer.address}</span>
                          </div>
                        </div>

                        {/* Subscriptions */}
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Subscribed Plan</p>
                          <div className="flex gap-2">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                              customer.activePlans.breakfast ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-400'
                            }`}>
                              Breakfast
                            </span>
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                              customer.activePlans.lunch ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-400'
                            }`}>
                              Lunch
                            </span>
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                              customer.activePlans.dinner ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-400'
                            }`}>
                              Dinner
                            </span>
                          </div>
                        </div>

                        {customer.notes && (
                          <div className="mt-3 bg-slate-50 p-2.5 rounded-xl text-xs text-slate-500 italic">
                            "{customer.notes}"
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-50/50 px-6 py-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                          Since {new Date(customer.createdAt).toLocaleDateString()}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditCustomerModal(customer)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(customer.id)}
                            className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </div>
            </div>
          )}

          {/* ======================================= */}
          {/* Billing Ledger tab                      */}
          {/* ======================================= */}
          {activeTab === 'billing' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Generate Bill Form & Preview */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
                  <h3 className="font-bold text-slate-800 text-lg">Calculate Invoice</h3>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Select Customer</label>
                    <select
                      value={billingCustId}
                      onChange={(e) => {
                        setBillingCustId(e.target.value);
                        setGeneratedBillPreview(null);
                      }}
                      className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option value="">-- Choose Customer --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Start Date</label>
                      <input
                        type="date"
                        value={billingStartDate}
                        onChange={(e) => {
                          setBillingStartDate(e.target.value);
                          setGeneratedBillPreview(null);
                        }}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 block w-full bg-slate-50/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">End Date</label>
                      <input
                        type="date"
                        value={billingEndDate}
                        onChange={(e) => {
                          setBillingEndDate(e.target.value);
                          setGeneratedBillPreview(null);
                        }}
                        className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 block w-full bg-slate-50/50"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleCalculateBill}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
                  >
                    Calculate Summary
                  </button>
                </div>

                {/* Live Bill Preview */}
                {generatedBillPreview && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-dashed border-slate-300 p-6 rounded-2xl space-y-4 shadow-sm relative overflow-hidden"
                  >
                    {/* Invoice background circle accent */}
                    <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 h-32 w-32 rounded-full bg-emerald-50/40"></div>

                    <div className="border-b border-dashed border-slate-100 pb-3">
                      <h4 className="font-extrabold text-slate-800">Invoice Estimate</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{billingStartDate} to {billingEndDate}</p>
                    </div>

                    <div className="text-xs text-slate-600 space-y-2">
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>Customer Name:</span>
                        <span>{generatedBillPreview.customer.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Delivered Runs:</span>
                        <span>{generatedBillPreview.deliveriesList.length} deliveries</span>
                      </div>
                    </div>

                    {/* Meal breakdown table */}
                    <div className="bg-slate-50 p-3 rounded-xl space-y-2.5 text-xs">
                      {generatedBillPreview.breakfastCount > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>Breakfasts ({generatedBillPreview.breakfastCount} * ₹{generatedBillPreview.customer.breakfastRate})</span>
                          <span className="font-semibold text-slate-800">₹{generatedBillPreview.breakfastCount * generatedBillPreview.customer.breakfastRate}</span>
                        </div>
                      )}
                      {generatedBillPreview.lunchCount > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>Lunches ({generatedBillPreview.lunchCount} * ₹{generatedBillPreview.customer.lunchRate})</span>
                          <span className="font-semibold text-slate-800">₹{generatedBillPreview.lunchCount * generatedBillPreview.customer.lunchRate}</span>
                        </div>
                      )}
                      {generatedBillPreview.dinnerCount > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>Dinners ({generatedBillPreview.dinnerCount} * ₹{generatedBillPreview.customer.dinnerRate})</span>
                          <span className="font-semibold text-slate-800">₹{generatedBillPreview.dinnerCount * generatedBillPreview.customer.dinnerRate}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-dashed border-slate-100 pt-3">
                      <span className="font-bold text-slate-800 text-sm">Total Due amount:</span>
                      <span className="font-black text-xl text-emerald-600 flex items-center">
                        <IndianRupee className="h-4 w-4" />
                        {generatedBillPreview.totalAmount}
                      </span>
                    </div>

                    <button
                      onClick={handleSaveBill}
                      disabled={actionLoading}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs cursor-pointer transition-colors"
                    >
                      Publish & Issue Bill
                    </button>
                  </motion.div>
                )}
              </div>

              {/* Right Column: Historical / Active Bills Ledger */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none">
                  {/* Print Only Header */}
                  <div className="hidden print:block p-6 border-b border-slate-200 bg-white text-slate-900">
                    <h1 className="text-2xl font-black tracking-tight text-emerald-800">MANJARA MANE ADUGE CATERERS</h1>
                    <p className="text-sm font-bold text-slate-500 mt-1">Invoice Dispatch Ledger Log</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Billing interval: Historical Records &nbsp;|&nbsp; Total invoices logged: {bills.length}
                    </p>
                  </div>

                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2 print:hidden">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-emerald-600" />
                      Invoice Dispatch Ledger ({bills.length})
                    </h3>
                    {bills.length > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={exportBillsToCSV}
                          className="px-3 py-1.5 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 bg-white flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                          title="Export all published invoices to Excel/CSV"
                        >
                          <Download className="h-3.5 w-3.5 text-emerald-600" />
                          Export Ledger
                        </button>
                        <button
                          onClick={handlePrintWindow}
                          className="px-3 py-1.5 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 bg-white flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                          title="Print the entire ledger log sheet"
                        >
                          <Printer className="h-3.5 w-3.5 text-emerald-600" />
                          Print PDF
                        </button>
                      </div>
                    )}
                  </div>

                  {bills.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                      <p className="font-medium">No customer invoices published yet.</p>
                      <p className="text-xs mt-1">Select a customer on the left to calculate and publish real invoices instantly!</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 text-xs font-bold uppercase">
                            <th className="py-4 px-6">Invoice ID / Date</th>
                            <th className="py-4 px-6">Customer</th>
                            <th className="py-4 px-6">Interval</th>
                            <th className="py-4 px-6">Breakdown</th>
                            <th className="py-4 px-6">Amount</th>
                            <th className="py-4 px-6">Status</th>
                            <th className="py-4 px-6 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                          {bills.map((bill) => (
                            <tr key={bill.id} className="hover:bg-slate-50/10">
                              <td className="py-4 px-6 font-bold text-xs text-slate-500 font-mono">
                                {bill.id}
                              </td>
                              <td className="py-4 px-6">
                                <div className="font-bold text-slate-800">{bill.customerName}</div>
                              </td>
                              <td className="py-4 px-6 text-xs text-slate-400 whitespace-nowrap">
                                {new Date(bill.startDate).toLocaleDateString()} - {new Date(bill.endDate).toLocaleDateString()}
                              </td>
                              <td className="py-4 px-6 text-xs text-slate-500 whitespace-nowrap">
                                <div>Breakfasts: <span className="font-semibold">{bill.breakfastCount}</span></div>
                                <div>Lunches: <span className="font-semibold">{bill.lunchCount}</span></div>
                                <div>Dinners: <span className="font-semibold">{bill.dinnerCount}</span></div>
                              </td>
                              <td className="py-4 px-6 font-bold text-slate-800 text-sm">
                                ₹{bill.totalAmount}
                              </td>
                              <td className="py-4 px-6">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                                  bill.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {bill.status}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-right space-x-1.5 whitespace-nowrap print:hidden">
                                <button
                                  onClick={() => setViewingInvoice(bill)}
                                  className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer inline-block"
                                  title="View / Print Printable Invoice PDF"
                                >
                                  <Printer className="h-4.5 w-4.5" />
                                </button>
                                {bill.status === 'unpaid' && (
                                  <button
                                    onClick={() => handleMarkBillPaid(bill.id)}
                                    className="px-2.5 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-colors cursor-pointer inline-block"
                                  >
                                    Mark Paid
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteBill(bill.id)}
                                  className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors cursor-pointer inline-block"
                                  title="Delete Invoice"
                                >
                                  <Trash2 className="h-4.5 w-4.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ======================================= */}
          {/* Rider Status tab                        */}
          {/* ======================================= */}
          {activeTab === 'riders' && (
            <div className="space-y-6">
              {/* Riders board */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    Delivery boys status tracker for {deliveryDate}
                  </h3>
                  <button
                    onClick={() => {
                      openCreateUserModal();
                      setUserRole('delivery');
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Add Delivery Boy
                  </button>
                </div>

                {riders.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <p className="font-medium">No delivery boy accounts registered yet.</p>
                    <p className="text-xs mt-1">Click the 'Add Delivery Boy' button above to create rider credentials!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 text-xs font-bold uppercase">
                          <th className="py-4 px-6">Rider Name</th>
                          <th className="py-4 px-6">Phone Number</th>
                          <th className="py-4 px-6">Email</th>
                          <th className="py-4 px-6">Daily Target Metrics</th>
                          <th className="py-4 px-6">Completes</th>
                          <th className="py-4 px-6">Role Status</th>
                          <th className="py-4 px-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                        {riders.map((rider) => {
                          const completed = riderCompletedCount(rider.id);
                          const pending = riderPendingCount(rider.id);
                          const total = completed + pending;
                          const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

                          return (
                            <tr key={rider.id} className="hover:bg-slate-50/20">
                              <td className="py-4 px-6">
                                <div className="font-bold text-slate-800 flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs uppercase">
                                    {rider.name[0]}
                                  </div>
                                  {rider.name}
                                </div>
                              </td>
                              <td className="py-4 px-6 font-mono text-xs">
                                {rider.phone || 'No phone set'}
                              </td>
                              <td className="py-4 px-6 text-xs text-slate-400">
                                {rider.email}
                              </td>
                              <td className="py-4 px-6">
                                <div className="w-full max-w-xs space-y-1">
                                  <div className="flex justify-between text-xs font-bold text-slate-500">
                                    <span>Progress</span>
                                    <span>{completed}/{total} delivered ({progressPct}%)</span>
                                  </div>
                                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div
                                      className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                                      style={{ width: `${progressPct}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                <div className="flex gap-2">
                                  <span className="px-2 py-0.5 rounded bg-green-50 text-green-700 text-xs font-bold">
                                    {completed} Done
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-xs font-bold">
                                    {pending} Pending
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600">
                                  <CheckCircle className="h-4.5 w-4.5 text-green-500" /> Active Boy
                                </span>
                              </td>
                              <td className="py-4 px-6 text-right whitespace-nowrap">
                                <button
                                  onClick={() => openEditUserModal(rider)}
                                  className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer inline-block mr-1.5"
                                  title="Edit Rider Credentials"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(rider.id, rider.name)}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer inline-block"
                                  title="Delete Rider Profile"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================= */}
          {/* Team / Users Management tab            */}
          {/* ======================================= */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">
                      Users & Administrators
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Add, update, or remove Administrators and Delivery Boys. Set passwords and usernames.
                    </p>
                  </div>
                  <button
                    onClick={openCreateUserModal}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-md shadow-emerald-600/10"
                  >
                    <Plus className="h-4 w-4" />
                    Add Team Member / Admin
                  </button>
                </div>

                {allUsers.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <p className="font-medium">No system users registered yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 text-xs font-bold uppercase">
                          <th className="py-4 px-6">Name / Display</th>
                          <th className="py-4 px-6">Username / Sign-In Name</th>
                          <th className="py-4 px-6">Email Address</th>
                          <th className="py-4 px-6">Password</th>
                          <th className="py-4 px-6">Phone</th>
                          <th className="py-4 px-6">Role</th>
                          <th className="py-4 px-6">Status</th>
                          <th className="py-4 px-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                        {allUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-slate-50/20">
                            <td className="py-4 px-6">
                              <div className="font-bold text-slate-800 flex items-center gap-2.5">
                                <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                                  user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {user.name[0]}
                                </div>
                                <div>
                                  <p>{user.name}</p>
                                  <p className="text-[10px] text-slate-400 font-medium">UID: {user.id.substring(0, 8)}...</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6 font-semibold text-slate-700">
                              {user.username || user.email.split('@')[0]}
                            </td>
                            <td className="py-4 px-6 text-xs font-mono text-slate-500">
                              {user.email}
                            </td>
                            <td className="py-4 px-6">
                              <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold border border-slate-200">
                                {user.password || '••••••'}
                              </span>
                            </td>
                            <td className="py-4 px-6 font-mono text-xs">
                              {user.phone || 'N/A'}
                            </td>
                            <td className="py-4 px-6">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                                user.role === 'admin' 
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-1.5">
                                <span className={`h-2.5 w-2.5 rounded-full inline-block ${
                                  user.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-slate-300'
                                }`} title={user.status}></span>
                                <span className="text-xs capitalize font-medium">{user.status}</span>
                              </div>
                            </td>
                            <td className="py-4 px-6 text-right whitespace-nowrap">
                              <button
                                onClick={() => openEditUserModal(user)}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer inline-block mr-1"
                                title="Edit User Settings"
                              >
                                <Edit2 className="h-4.5 w-4.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id, user.name)}
                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer inline-block"
                                title="Delete User Account"
                              >
                                <Trash2 className="h-4.5 w-4.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Reset Controls Card */}
              <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-red-50 bg-red-50/50 flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-red-600" />
                  <div>
                    <h3 className="font-bold text-red-800 text-lg">
                      Danger Zone: Database & System Reset
                    </h3>
                    <p className="text-xs text-red-600 font-medium">
                      Administrative reset options to purge or wipe operational logs.
                    </p>
                  </div>
                </div>

                <div className="p-6 space-y-6 divide-y divide-slate-100">
                  {/* Row 1: Reset deliveries */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6">
                    <div className="max-w-xl">
                      <h4 className="font-bold text-slate-800 text-sm">
                        Reset Today's Deliveries
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Deletes all active and pending delivery logs for the currently selected date (<span className="font-semibold text-slate-700">{deliveryDate}</span>). This allows you to re-initialize deliveries for today from customer subscriptions.
                      </p>
                    </div>
                    <div>
                      <button
                        onClick={handleResetDeliveriesToday}
                        className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 px-4 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Clock className="h-4 w-4 text-slate-500" />
                        Reset Deliveries
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Reset Billing */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-6">
                    <div className="max-w-xl">
                      <h4 className="font-bold text-slate-800 text-sm">
                        Purge All Generated Invoices
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Deletes every billing ledger invoice entry from the Firestore database. Active client subscription rules and general customer profiles are not affected.
                      </p>
                    </div>
                    <div>
                      <button
                        onClick={handleResetAllBilling}
                        className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 px-4 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <FileText className="h-4 w-4 text-slate-500" />
                        Purge Invoices
                      </button>
                    </div>
                  </div>

                  {/* Row 3: Full factory reset */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pt-6">
                    <div className="max-w-2xl">
                      <h4 className="font-bold text-red-600 text-sm">
                        Complete System Factory Reset
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Deletes <strong className="text-red-600">ALL data</strong> across all collections including: Customers, Deliveries, Billing, and other delivery riders/users. 
                        Your current Admin account will be spared so you can stay logged in. All custom subscriptions and delivery sheets are wiped.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Type 'RESET' to unlock"
                          value={resetConfirmText}
                          onChange={(e) => setResetConfirmText(e.target.value)}
                          className="w-full sm:w-48 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                        />
                      </div>
                      <button
                        onClick={handleFactoryReset}
                        disabled={resetConfirmText.toUpperCase() !== 'RESET'}
                        className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          resetConfirmText.toUpperCase() === 'RESET'
                            ? 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/15'
                            : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                        }`}
                      >
                        <Trash2 className="h-4 w-4" />
                        Wipe Everything
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
        </main>
      </div>

      {/* CUSTOMER MODAL (ADD / EDIT) */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 my-8"
          >
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
              <h4 className="font-bold text-white text-lg">
                {editingCustomer ? 'Edit Customer Settings' : 'Register New Customer'}
              </h4>
              <button
                onClick={() => {
                  setIsCustomerModalOpen(false);
                  resetCustomerForm();
                }}
                className="text-slate-400 hover:text-white font-bold cursor-pointer text-xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Customer Full Name</label>
                  <input
                    type="text"
                    required
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800"
                    placeholder="Enter full name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mobile Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800"
                    placeholder="10-digit number"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Default Members (Boxes)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={custMembers}
                    onChange={(e) => setCustMembers(Number(e.target.value))}
                    className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Delivery Dropoff Address</label>
                <textarea
                  required
                  rows={2}
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800"
                  placeholder="Enter full address, floor, flat details"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Active Meal Schedules</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={custPlans.breakfast}
                      onChange={(e) => setCustPlans({ ...custPlans, breakfast: e.target.checked })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 h-4.5 w-4.5 cursor-pointer"
                    />
                    Breakfast
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={custPlans.lunch}
                      onChange={(e) => setCustPlans({ ...custPlans, lunch: e.target.checked })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 h-4.5 w-4.5 cursor-pointer"
                    />
                    Lunch
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={custPlans.dinner}
                      onChange={(e) => setCustPlans({ ...custPlans, dinner: e.target.checked })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 h-4.5 w-4.5 cursor-pointer"
                    />
                    Dinner
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Custom Pricing per meal (₹)</label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Breakfast</label>
                    <input
                      type="number"
                      required
                      value={custBreakfastRate}
                      onChange={(e) => setCustBreakfastRate(Number(e.target.value))}
                      className="block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Lunch</label>
                    <input
                      type="number"
                      required
                      value={custLunchRate}
                      onChange={(e) => setCustLunchRate(Number(e.target.value))}
                      className="block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Dinner</label>
                    <input
                      type="number"
                      required
                      value={custDinnerRate}
                      onChange={(e) => setCustDinnerRate(Number(e.target.value))}
                      className="block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Delivery Instructions / Notes</label>
                <input
                  type="text"
                  value={custNotes}
                  onChange={(e) => setCustNotes(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800"
                  placeholder="e.g. Vegetarian only, Ring bell loud"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomerModalOpen(false);
                    resetCustomerForm();
                  }}
                  className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl text-sm cursor-pointer transition-colors"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* USER MODAL (ADD / EDIT TEAM MEMBER / ADMIN) */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 my-8"
          >
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
              <h4 className="font-bold text-white text-lg">
                {editingUser ? 'Edit User Credentials' : 'Register New User/Admin'}
              </h4>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold cursor-pointer text-xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mobile Phone Number</label>
                <input
                  type="tel"
                  required
                  value={userPhone}
                  onChange={(e) => setUserPhone(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="10-digit number"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address (Username login mapping)</label>
                <input
                  type="email"
                  required
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="user@manjaramane.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Custom Username (Optional sign-in name)</label>
                <input
                  type="text"
                  value={userUsername}
                  onChange={(e) => setUserUsername(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="e.g. ManjaraManeAduge"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password (min 6 characters)</label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                  placeholder="Set login password"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">System Role</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as 'admin' | 'delivery')}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="delivery">Delivery Boy (Rider)</option>
                  <option value="admin">Administrator (Manager)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Account Status</label>
                <select
                  value={userStatus}
                  onChange={(e) => setUserStatus(e.target.value as 'active' | 'inactive')}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive / Suspended</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl text-sm cursor-pointer transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : editingUser ? 'Update User' : 'Register User'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* PRINTABLE INVOICE DETAIL VIEW MODAL */}
      {viewingInvoice && (() => {
        const customerObj = customers.find(c => c.id === viewingInvoice.customerId);
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto print:absolute print:inset-0 print:bg-white print:p-0 print:m-0 print:shadow-none print:border-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-100 my-8 print:shadow-none print:border-none print:my-0 print:rounded-none"
            >
              {/* Modal header on screen, hidden on print */}
              <div className="bg-slate-900 px-6 py-4 flex items-center justify-between print:hidden">
                <h4 className="font-bold text-white text-base flex items-center gap-2">
                  <FileText className="h-5 w-5 text-emerald-500" />
                  Print / Download Invoice Receipt
                </h4>
                <button
                  onClick={() => setViewingInvoice(null)}
                  className="text-slate-400 hover:text-white font-black cursor-pointer text-xl"
                >
                  &times;
                </button>
              </div>

              {/* Printable Invoice Container */}
              <div className="p-8 space-y-6 md:p-10 bg-white text-slate-800" id="printable-invoice">
                {/* Invoice header */}
                <div className="flex justify-between items-start border-b border-slate-200 pb-6 flex-wrap gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-emerald-800 tracking-tight uppercase">MANJARA MANE ADUGE</h2>
                    <p className="text-xs font-bold text-slate-500 uppercase mt-0.5">Pure Vegetarian Catering Services</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs">
                      Freshly Prepared Traditional Brahmin Style Lunch, Dinner & Breakfast Catering Services.
                    </p>
                  </div>
                  <div className="text-right sm:text-right">
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 font-black text-xs px-3 py-1.5 rounded-xl uppercase inline-block print:bg-white print:border-slate-300">
                      INVOICE RECEIPT
                    </div>
                    <p className="text-xs font-mono font-bold text-slate-400 mt-2">Invoice ID: {viewingInvoice.id}</p>
                    <p className="text-xs text-slate-500 mt-1">Issued: {new Date(viewingInvoice.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Billing details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed border-b border-slate-100 pb-6">
                  <div>
                    <p className="font-extrabold text-slate-400 uppercase tracking-wider mb-2">Billed To (Subscriber)</p>
                    <h4 className="font-extrabold text-slate-800 text-sm">{viewingInvoice.customerName}</h4>
                    <p className="text-slate-500 mt-1 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                      {customerObj?.phone || "N/A"}
                    </p>
                    <p className="text-slate-500 mt-1 flex items-start gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-300 mt-0.5" />
                      <span>{customerObj?.address || "Address not specified"}</span>
                    </p>
                  </div>
                  <div className="md:text-right">
                    <p className="font-extrabold text-slate-400 uppercase tracking-wider mb-2">Billing Interval</p>
                    <p className="font-bold text-slate-700 text-sm">
                      {new Date(viewingInvoice.startDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} 
                      &nbsp;to&nbsp;
                      {new Date(viewingInvoice.endDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-slate-500 mt-1">Status: <span className={`font-extrabold uppercase ${viewingInvoice.status === 'paid' ? 'text-green-600' : 'text-red-500'}`}>{viewingInvoice.status}</span></p>
                    {viewingInvoice.paidAt && (
                      <p className="text-[10px] text-slate-400 mt-0.5">Paid Date: {new Date(viewingInvoice.paidAt).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>

                {/* Charges Breakdowns */}
                <div className="space-y-3">
                  <h5 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">Itemized Tiffin & Catering Charge Log</h5>
                  <div className="overflow-hidden border border-slate-100 rounded-2xl print:border-slate-300">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold print:bg-white print:border-slate-300">
                          <th className="py-3 px-4">Item Subscribed</th>
                          <th className="py-3 px-4 text-center">Meals Logged</th>
                          <th className="py-3 px-4 text-right">Meal Rate (₹)</th>
                          <th className="py-3 px-4 text-right">Total Subtotal (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-600 print:divide-slate-300">
                        {viewingInvoice.breakfastCount > 0 && (
                          <tr>
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-800">Breakfast (Tiffin)</span>
                              <p className="text-[10px] text-slate-400 font-medium">Brahmin Style Morning Meals</p>
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-slate-800">
                              {viewingInvoice.breakfastCount} runs
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-600">
                              ₹{viewingInvoice.breakfastRate}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-slate-800">
                              ₹{viewingInvoice.breakfastCount * viewingInvoice.breakfastRate}
                            </td>
                          </tr>
                        )}
                        {viewingInvoice.lunchCount > 0 && (
                          <tr>
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-800">Lunch Meal Box</span>
                              <p className="text-[10px] text-slate-400 font-medium">Traditional Full Lunch Box</p>
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-slate-800">
                              {viewingInvoice.lunchCount} runs
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-600">
                              ₹{viewingInvoice.lunchRate}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-slate-800">
                              ₹{viewingInvoice.lunchCount * viewingInvoice.lunchRate}
                            </td>
                          </tr>
                        )}
                        {viewingInvoice.dinnerCount > 0 && (
                          <tr>
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-800">Dinner Meal Box</span>
                              <p className="text-[10px] text-slate-400 font-medium">Fresh Evening Dinner Box</p>
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-slate-800">
                              {viewingInvoice.dinnerCount} runs
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-600">
                              ₹{viewingInvoice.dinnerRate}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-slate-800">
                              ₹{viewingInvoice.dinnerCount * viewingInvoice.dinnerRate}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Grand Total */}
                <div className="flex justify-end pt-4">
                  <div className="w-full sm:w-64 bg-slate-50 p-4 rounded-2xl space-y-2 border border-slate-100 print:bg-white print:border-slate-300">
                    <div className="flex justify-between text-xs text-slate-500 font-medium">
                      <span>Total Base Price:</span>
                      <span className="font-mono">₹{viewingInvoice.totalAmount}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 font-medium border-b border-slate-200/60 pb-2">
                      <span>Delivery Fees / GST:</span>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase">FREE / INCLUDED</span>
                    </div>
                    <div className="flex justify-between text-sm items-center pt-1">
                      <span className="font-black text-slate-800">Grand Total Due:</span>
                      <span className="text-lg font-black text-emerald-600 font-mono">₹{viewingInvoice.totalAmount}</span>
                    </div>
                  </div>
                </div>

                {/* Bank / UPI / Instructions */}
                <div className="bg-emerald-50/40 p-4.5 rounded-2xl border border-emerald-600/10 text-[10px] text-slate-500 space-y-1.5 print:bg-white print:border-slate-300">
                  <h6 className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px] mb-1">Direct Bank & UPI Transfer details</h6>
                  <p className="flex justify-between">
                    <span><strong>GPay / PhonePe UPI No:</strong> 9886475632@okaxis</span>
                    <span><strong>Acc Name:</strong> Manjara Mane Aduge</span>
                  </p>
                  <p className="flex justify-between">
                    <span><strong>Account Transfer No:</strong> 40990201012356 &nbsp;|&nbsp; <strong>IFSC:</strong> ICIC0004099</span>
                    <span><strong>Bank:</strong> ICICI Bank, Jayanagar</span>
                  </p>
                  <div className="text-[9px] text-slate-400 leading-normal pt-1 border-t border-slate-200/50 mt-1 text-center">
                    Thank you for your valuable subscription! For billing support or plan alterations, call +91-9886475632.
                  </div>
                </div>
              </div>

              {/* Modal controls, hidden during printing */}
              <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100 print:hidden">
                <button
                  type="button"
                  onClick={() => setViewingInvoice(null)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl text-sm cursor-pointer transition-colors flex items-center gap-2"
                >
                  <Printer className="h-4.5 w-4.5" />
                  Print / Save PDF
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* SCHEDULE AD-HOC DELIVERY MODAL */}
      {isAdHocModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100"
          >
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
              <h4 className="font-bold text-white text-base flex items-center gap-2">
                <Plus className="h-5 w-5 text-emerald-500" />
                Schedule Ad-Hoc Delivery Run
              </h4>
              <button
                onClick={() => setIsAdHocModalOpen(false)}
                className="text-slate-400 hover:text-white font-black cursor-pointer text-xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveAdHocDelivery} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Subscriber / Customer</label>
                <select
                  value={adHocCustId}
                  onChange={(e) => {
                    const cid = e.target.value;
                    setAdHocCustId(cid);
                    const customer = customers.find(c => c.id === cid);
                    if (customer) {
                      setAdHocBoxes(customer.members || 1);
                    }
                  }}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                >
                  <option value="" disabled>-- Select Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Run Date</label>
                  <input
                    type="date"
                    value={adHocDate}
                    onChange={(e) => setAdHocDate(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Meal Type</label>
                  <select
                    value={adHocMealType}
                    onChange={(e) => setAdHocMealType(e.target.value as any)}
                    className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    required
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Box / Portion Count</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={adHocBoxes}
                  onChange={(e) => setAdHocBoxes(Number(e.target.value))}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Chef Instructions / Special Notes</label>
                <textarea
                  value={adHocNotes}
                  onChange={(e) => setAdHocNotes(e.target.value)}
                  placeholder="e.g. Extra spicy, send sweet, guest meal"
                  rows={2}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdHocModalOpen(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl text-sm cursor-pointer transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Scheduling...' : 'Add to Run Sheet'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* EDIT INDIVIDUAL DELIVERY INSTANCE MODAL */}
      {isEditingDelivery && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100"
          >
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
              <h4 className="font-bold text-white text-base flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-emerald-500" />
                Edit Scheduled Meal Delivery
              </h4>
              <button
                onClick={() => setIsEditingDelivery(null)}
                className="text-slate-400 hover:text-white font-black cursor-pointer text-xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEditedDelivery} className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Subscriber</p>
                <p className="text-sm font-bold text-slate-800">{isEditingDelivery.customerName}</p>
                <div className="flex gap-2 items-center pt-1.5">
                  <span className="text-xs font-bold text-slate-500">Run date: {isEditingDelivery.date}</span>
                  <span className="h-1 w-1 bg-slate-300 rounded-full"></span>
                  <span className="text-xs font-bold uppercase text-emerald-700">{isEditingDelivery.mealType}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Today's Box / Portion Count</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={editDeliveryBoxes}
                  onChange={(e) => setEditDeliveryBoxes(Number(e.target.value))}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                  Changing this count will accurately affect the generated bills and invoice totals for this delivery date!
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Chef Instructions / Special Notes</label>
                <textarea
                  value={editDeliveryNotes}
                  onChange={(e) => setEditDeliveryNotes(e.target.value)}
                  placeholder="e.g. Less spice, extra curd, don't deliver today"
                  rows={3}
                  className="block w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditingDelivery(null)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl text-sm cursor-pointer transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Apply Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
