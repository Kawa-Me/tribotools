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
  isActive?: boolean;
  hasCredentials?: boolean;
  hasCookies?: boolean;
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
}

export interface Product {
    id: string;
    name: string;
    order: number;
    plans: Plan[];
}

export interface UserSubscription {
  status: 'active' | 'expired' | 'none';
  plan: string | null;
  expiresAt: Timestamp | null;
  startedAt: Timestamp | null;
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
  role?: 'admin' | 'user';
  emailVerified: boolean;
  isAnonymous: boolean;
}

export interface AuthContextType {
  user: UserData | null;
  loading: boolean;
}
