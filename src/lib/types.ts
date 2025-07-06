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
}

export interface Module {
  id:string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  lessons: Lesson[];
  order: number;
}

export interface UserSubscription {
  status: 'active' | 'expired' | 'none';
  plan: 'mensal' | 'trimestral' | null;
  expiresAt: Timestamp | null;
  startedAt: Timestamp | null;
}

export interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  subscription: UserSubscription;
  role?: 'admin' | 'user';
  isAnonymous: boolean;
}

export interface AuthContextType {
  user: UserData | null;
  loading: boolean;
}
