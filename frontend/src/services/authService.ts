import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  User
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  subscriptionPlan: string;
  createdAt: any;
  updatedAt: any;
}

class AuthService {
  // Register new user
  async register(data: RegisterData): Promise<User> {
    try {
      // 1. Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      // 2. Update Auth profile with name
      try {
        await updateProfile(userCredential.user, {
          displayName: data.name
        });
      } catch (e) {
        console.warn('Could not update profile displayName:', e);
      }

      // 3. Create user document in Firestore (non-blocking if rules are restricted)
      try {
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          name: data.name,
          email: data.email,
          phone: data.phone || '',
          subscriptionPlan: 'free',
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (firestoreErr) {
        console.warn('Firestore user profile sync note (check security rules):', firestoreErr);
      }

      return userCredential.user;
    } catch (error: any) {
      const errorCode = error.code;
      let errorMessage = 'Registration failed';

      switch (errorCode) {
        case 'auth/email-already-in-use':
          errorMessage = 'This email is already registered. Please login or use a different email.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address format.';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Email/password accounts are not enabled in Firebase Console. Please enable Email/Password provider.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak. Please use at least 6 characters.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection.';
          break;
        default:
          errorMessage = error.message || 'Registration failed. Please try again.';
      }

      throw new Error(errorMessage);
    }
  }

  // Login user with email/password
  async login(data: LoginData): Promise<User> {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      // Try updating last login in Firestore (non-blocking)
      try {
        const userRef = doc(db, 'users', userCredential.user.uid);
        await setDoc(userRef, {
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.warn('Firestore update last login note:', e);
      }

      return userCredential.user;
    } catch (error: any) {
      const errorCode = error.code;
      let errorMessage = 'Login failed';

      switch (errorCode) {
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address format.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This account has been disabled. Please contact support.';
          break;
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email. Please register first.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password. Please try again.';
          break;
        case 'auth/invalid-credential':
          errorMessage = 'Invalid email or password. Please check your credentials.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed login attempts. Please try again later.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection.';
          break;
        default:
          errorMessage = error.message || 'Login failed. Please try again.';
      }

      throw new Error(errorMessage);
    }
  }

  // Sign In with Google
  async loginWithGoogle(): Promise<User> {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      // Sync Firestore profile (non-blocking if Firestore rules block writes)
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            name: user.displayName || 'Google Trader',
            email: user.email || '',
            phone: user.phoneNumber || '',
            subscriptionPlan: 'free',
            isActive: true,
            photoURL: user.photoURL || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } else {
          await setDoc(userRef, {
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      } catch (firestoreErr) {
        console.warn('Firestore profile sync note (check security rules):', firestoreErr);
      }

      return user;
    } catch (error: any) {
      const errorCode = error.code;
      let errorMessage = 'Google Sign-In failed';

      switch (errorCode) {
        case 'auth/popup-closed-by-user':
          errorMessage = 'Sign-in cancelled by user.';
          break;
        case 'auth/popup-blocked':
          errorMessage = 'Pop-up blocked by browser. Please allow pop-ups for this site.';
          break;
        case 'auth/cancelled-popup-request':
          errorMessage = 'Sign-in request cancelled.';
          break;
        case 'auth/account-exists-with-different-credential':
          errorMessage = 'An account already exists with the same email address using different sign-in credentials.';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Google Sign-In is not enabled in Firebase Console. Please enable Google provider under Authentication -> Sign-in method.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection.';
          break;
        default:
          errorMessage = error.message || 'Google Sign-In failed. Please try again.';
      }

      throw new Error(errorMessage);
    }
  }

  // Logout user
  async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error: any) {
      throw new Error(error.message || 'Logout failed');
    }
  }

  // Reset password
  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      const errorCode = error.code;
      let errorMessage = 'Password reset failed';

      switch (errorCode) {
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address format.';
          break;
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection.';
          break;
        default:
          errorMessage = error.message || 'Password reset failed. Please try again.';
      }

      throw new Error(errorMessage);
    }
  }

  // Get current user
  getCurrentUser(): User | null {
    return auth.currentUser;
  }

  // Get user profile from Firestore (with automatic fallback to Auth profile)
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const currentUser = auth.currentUser;

    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return userDoc.data() as UserProfile;
      }
    } catch (error: any) {
      console.warn('Could not read user profile from Firestore, using Auth profile:', error.message);
    }

    // Fallback to Firebase Auth user metadata
    if (currentUser && currentUser.uid === uid) {
      return {
        uid: currentUser.uid,
        name: currentUser.displayName || currentUser.email?.split('@')[0] || 'Trader',
        email: currentUser.email || '',
        phone: currentUser.phoneNumber || undefined,
        subscriptionPlan: 'free',
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    return null;
  }

  // Update user profile
  async updateProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, {
        ...data,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error: any) {
      console.warn('Firestore updateProfile warning:', error.message);
    }
  }

  // Get auth token
  async getToken(): Promise<string | null> {
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
    return null;
  }
}

export default new AuthService();
