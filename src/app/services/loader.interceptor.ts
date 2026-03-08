import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { LoaderService } from './loader.service';

@Injectable()
export class LoaderInterceptor implements HttpInterceptor {
  constructor(private loaderService: LoaderService) {}

  /**
   * Intercept HTTP requests and show loader
   * Hide loader when request completes or errors
   * @param request The outgoing request
   * @param next The next handler in the chain
   * @returns The HTTP event observable
   */
  intercept(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // Show loader when request starts
    this.loaderService.show();

    return next.handle(request).pipe(
      finalize(() => {
        // Hide loader when request completes or errors
        this.loaderService.hide();
      })
    );
  }
}
