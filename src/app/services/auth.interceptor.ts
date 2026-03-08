import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
} from '@angular/common/http';
import { Observable } from 'rxjs';
//import { AuthService } from './auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  //constructor(private authService: AuthService) {}

  /**
   * Intercept HTTP requests and add bearer token to Authorization header
   * @param request The outgoing request
   * @param next The next handler in the chain
   * @returns The HTTP event observable
   */
  intercept(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    //const authToken = this.authService.getAuthToken();

    
      // Clone the request and add the Authorization header with bearer token
      request = request.clone({
        // setHeaders: {
        //   Authorization: `Bearer ${authToken}`,
        // },
        withCredentials: true
      });
      console.log('[AuthInterceptor] Authorization header added to request');
    

    return next.handle(request);
  }
}
