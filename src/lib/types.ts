import type { User as FirebaseUser } from 'firebase/auth';
import type { Timestamp } from 'firebase/firestore';

export interface LessonCookie {
  name: string;
  value: string;
}

export interface Lesson {
  id: string;
  title: string;
  type: 'video' | 'text';
  content: string; // URL for video, Markdown for additional notes on text lessons
  imageUrl?: string;
  order: number;
  accessUrl?: string;
  buttonText?: string;
  accessEmail?: string;
  accessPassword?: string;
  cookies?: LessonCookie[];
  status?: 'active' | 'maintenance' | 'coming_soon';
  hasCredentials?: boolean;
  hasCookies?: boolean;
  hasInstructionalVideo?: boolean;
  instructionalVideoUrl?: string;
}

export interface Module {
  id:string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  lessons: Lesson[];
  order: number;
  permission: string;
}

export interface Plan {
    id: string;
    name: string;
    price: number;
    originalPrice?: number;
    description: string;
    days: number;
    promo: boolean;
    productId: string;
    productName: string;
}

export interface Product {
    id: string;
    name: string;
    order: number;
    plans: Omit<Plan, 'productId' | 'productName'>[];
}

export interface Coupon {
  id: string; // The coupon code itself, case-insensitive
  discountPercentage: number;
  startDate: Timestamp;
  endDate: Timestamp;
  applicableProductIds: string[]; // List of product IDs it applies to. Empty array means ALL products.
  isActive: boolean;
}

export interface Affiliate {
  id: string;
  userId?: string;
  ref_code: string;
  name: string;
  email: string;
  phone?: string;
  pix_key: string;
  pix_type: 'cpf' | 'email' | 'telefone' | 'chave_aleatoria';
  commission_percent: number;
  pending_balance: number;
  available_balance: number;
  paid_balance: number;
  total_earned: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface WithdrawRequest {
    id: string;
    ref_code: string;
    amount: number;
    status: 'requested' | 'paid' | 'rejected';
    requested_at: Timestamp;
    paid_at: Timestamp | null;
    pix_key: string;
    pix_type: Affiliate['pix_type'];
}

export interface UserSubscription {
  status: 'active' | 'expired' | 'none';
  planId: string | null;
  expiresAt: Timestamp | null;
  startedAt: Timestamp | null;
  lastTransactionId?: string;
}

export interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  name?: string;
  document?: string;
  phone?: string;
  photoURL: string | null;
  subscriptions: { [key: string]: UserSubscription };
  role?: 'admin' | 'user' | 'affiliate';
  emailVerified: boolean;
  isAnonymous: boolean;
  createdAt?: Timestamp;
}

export interface AuthContextType {
  user: UserData | null;
  loading: boolean;
}

export interface Payment {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userPhone?: string;
  planIds: string[];
  basePrice: number;
  appliedCoupon: { id: string; discountPercentage: number } | null;
  discountAmount: number;
  totalPrice: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Timestamp;
  processedAt?: Timestamp;
  pushinpayTransactionId?: string;
  pushinpayEndToEndId?: string;
  failureReason?: string;
  affiliateId?: string | null;
  commission?: number;
  commissionStatus?: 'pending' | 'released' | 'paid' | 'cancelled';
}
