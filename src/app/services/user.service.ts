import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { APP_CONSTANTS } from '../app.constants';
export interface UserInfo {
  id?: string;
  name?: string;
  email?: string;
  [key: string]: any; // Allow for additional user properties
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly API_URL = `${APP_CONSTANTS.API_BASE_URL}/users/me`;
  private userSubject = new BehaviorSubject<UserInfo | null>(null);
  public user$ = this.userSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  /**
   * Get the current cached user data
   * @returns The cached user info or null
   */
  getCurrentUser(): UserInfo | null {
    return this.userSubject.getValue();
  }

  /**
   * Fetch user information from API
   * @returns Observable of user info
   */
  fetchUserInfo(): Observable<UserInfo> {
   // const authToken = this.authService.getAuthToken();
   const authToken = this.authService.getAuthToken();
    console.log('[UserService] Fetching user info with auth token:', authToken ? 'Present' : 'Not present');
    const headers = new HttpHeaders();

    if (authToken) {
      headers.append('Authorization', `Bearer ${authToken}`);
      console.log('[UserService] Authorization header set with Bearer token');
    } else {
      console.warn('[UserService] No auth token available for user info request');
    }

    return this.http.get<UserInfo>(this.API_URL, { withCredentials: true }).pipe(
      tap(userInfo => {
        console.log('[UserService] User info loaded successfully:', userInfo);
        this.userSubject.next(userInfo);
      }),
      catchError(error => {
        console.error('[UserService] Failed to fetch user info:', error);
        // Return empty user object on error so app can still load
        const emptyUser: UserInfo = {};
        this.userSubject.next(emptyUser);
        return of(emptyUser);
      })
    );
  }

  /**
   * Set user info manually
   * @param userInfo The user info to set
   */
  setUserInfo(userInfo: UserInfo): void {
    this.userSubject.next(userInfo);
  }

  /**
   * Clear user info
   */
  clearUserInfo(): void {
    this.userSubject.next(null);
  }
}
