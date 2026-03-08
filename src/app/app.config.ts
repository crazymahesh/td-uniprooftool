import { ApplicationConfig, provideBrowserGlobalErrorListeners, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CookieService } from 'ngx-cookie-service';

import { routes } from './app.routes';
import { AuthService } from './services/auth.service';
import { AuthInterceptor } from './services/auth.interceptor';
import { LoaderInterceptor } from './services/loader.interceptor';
import { LoaderService } from './services/loader.service';
import { UserService } from './services/user.service';

/**
 * Initialize auth service to load token from cookie before app starts
 */
export function initializeAuth(authService: AuthService) {
  return () => {
    // AuthService constructor already initializes token from cookie
    // This ensures it's loaded before any HTTP requests are made
    return Promise.resolve();
  };
}

/**
 * Initialize user service to fetch user information before app starts
 */
export function initializeUser(userService: UserService) {
  return () => {
    return firstValueFrom(userService.fetchUserInfo());
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LoaderInterceptor,
      multi: true
    },
    AuthService,
    CookieService,
    UserService,
    LoaderService,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuth,
      deps: [AuthService],
      multi: true
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeUser,
      deps: [UserService],
      multi: true
    }
  ]
};
