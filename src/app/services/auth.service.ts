import { Injectable } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'auth_token';
  private authToken: string | null = null;

  constructor(private cookieService: CookieService) {
    this.initializeTokenFromCookie();
  }

  /**
   * Initialize auth token from cookie
   * Reads the auth_token from document cookies
   */
  private initializeTokenFromCookie(): void {
    this.authToken = this.getCookieValue(this.tokenKey);
    if (this.authToken) {
      console.log('[AuthService] Auth token loaded from cookie');
    }
  }

  /**
   * Get the current auth token
   * @returns The auth token or null if not set
   */
  getAuthToken(): string | null {
    if (!this.authToken) {
      this.initializeTokenFromCookie();
    }
    return this.authToken;
  }

  /**
   * Set the auth token
   * @param token The token to set
   */
  setAuthToken(token: string): void {
    this.authToken = token;
    console.log('[AuthService] Auth token set' + (token ? ' and saved to cookie' : ''));
    this.setTokenCookie(token);
  }

  /**
   * Clear the auth token
   */
  clearAuthToken(): void {
    this.authToken = null;
    this.deleteCookie(this.tokenKey);
  }

  /**
   * Get a specific cookie value by name
   * @param cookieName The name of the cookie
   * @returns The cookie value or empty string
   */
  private getCookieValue(cookieName: string): string | null {
    const cookieValue = this.cookieService.get(cookieName);
    return cookieValue || null;
  }

  /**
   * Set a cookie with the auth token
   * @param token The token value
   */
  private setTokenCookie(token: string): void {
    this.cookieService.set(this.tokenKey, token, {
      path: '/',
      sameSite: 'Lax',
      secure: false
    });
  }

  /**
   * Delete the auth token cookie
   */
  private deleteCookie(cookieName: string): void {
    this.cookieService.delete(cookieName, '/');
  }
}
