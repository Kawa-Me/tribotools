import type { User as FirebaseUser } from 'firebase/auth';
import type { Timestamp } from 'firebase/firestore';

export interface Lesson {
  id: string;
  title: string;
  type: 'video' | 'text';
  content: string; // URL for video, markdown string for text
}

export interface Module {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  lessons: Lesson[];
}

export interface UserSubscription {
  status: 'active' | 'expired' | 'none';
  plan: 'mensal' | 'trimestral' | 'anual' | null;
  expiresAt: Timestamp | null;
  startedAt: Timestamp | null;
}

export interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  subscription: UserSubscription;
}

export interface AuthContextType {
  user: UserData | null;
  loading: boolean;
}
