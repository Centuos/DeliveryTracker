export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'delivery';
  phone: string;
  status: 'active' | 'inactive';
  username?: string;
  password?: string;
  createdAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  members: number; // default number of members/boxes
  activePlans: {
    breakfast: boolean;
    lunch: boolean;
    dinner: boolean;
  };
  breakfastRate: number;
  lunchRate: number;
  dinnerRate: number;
  createdAt: string;
  notes?: string;
}

export interface Delivery {
  id: string;
  date: string; // YYYY-MM-DD
  mealType: 'breakfast' | 'lunch' | 'dinner';
  customerId: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  membersCount: number;
  deliveryBoyId: string | null;
  deliveryBoyName: string | null;
  status: 'pending' | 'picked_up' | 'delivered' | 'cancelled';
  pickupTime: string | null; // ISO string
  deliveryTime: string | null; // ISO string
  notes?: string;
}

export interface Bill {
  id: string;
  customerId: string;
  customerName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  breakfastCount: number;
  lunchCount: number;
  dinnerCount: number;
  breakfastRate: number;
  lunchRate: number;
  dinnerRate: number;
  totalAmount: number;
  status: 'unpaid' | 'paid';
  createdAt: string;
  paidAt?: string;
}
