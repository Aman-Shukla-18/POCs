import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../shared/utils';
import { resetDatabase } from '../db/database';
import { syncEngine } from '../sync/syncEngine';

const TAG = 'AuthService';
const AUTH_TOKEN_KEY = '@auth/token';
const AUTH_USER_KEY = '@auth/user';

// Default to localhost for iOS simulator
const BASE_URL = 'http://localhost:3000';

export interface User {
  id: string;
  email: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterResponse {
  id: string;
  email: string;
  created_at: number;
}

class AuthService {
  private currentUser: User | null = null;
  private token: string | null = null;

  /**
   * Initialize auth state from storage
   */
  async initialize(): Promise<User | null> {
    try {
      const [token, userJson] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(AUTH_USER_KEY),
      ]);

      if (token && userJson) {
        this.token = token;
        this.currentUser = JSON.parse(userJson);
        logger.info(TAG, `Restored session for user: ${this.currentUser?.email}`);
        return this.currentUser;
      }

      return null;
    } catch (error) {
      logger.error(TAG, 'Failed to initialize auth:', error);
      return null;
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Get auth token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Check if user is logged in
   */
  isLoggedIn(): boolean {
    return this.token !== null && this.currentUser !== null;
  }

  /**
   * Register a new user
   */
  async register(email: string, password: string): Promise<RegisterResponse> {
    logger.info(TAG, `Registering user: ${email}`);

    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    logger.info(TAG, `User registered: ${data.email}`);
    return data;
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<User> {
    logger.info(TAG, `Logging in user: ${email}`);

    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data: LoginResponse = await response.json();

    if (!response.ok) {
      throw new Error((data as any).error || 'Login failed');
    }

    // Save to state and storage
    this.token = data.token;
    this.currentUser = data.user;

    await Promise.all([
      AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token),
      AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user)),
    ]);

    logger.info(TAG, `User logged in: ${data.user.email}`);
    return data.user;
  }

  /**
   * Logout user
   * Clears auth tokens, local database, and sync state
   */
  async logout(): Promise<void> {
    logger.info(TAG, `Logging out user: ${this.currentUser?.email}`);

    this.token = null;
    this.currentUser = null;

    // Clear auth tokens
    await Promise.all([
      AsyncStorage.removeItem(AUTH_TOKEN_KEY),
      AsyncStorage.removeItem(AUTH_USER_KEY),
    ]);

    // Clear local database (so next user doesn't see previous user's data)
    await resetDatabase();

    // Clear sync state (so next user gets a full sync)
    await syncEngine.clearLastPulledAt();

    logger.info(TAG, 'User logged out - all local data cleared');
  }
}

export const authService = new AuthService();
