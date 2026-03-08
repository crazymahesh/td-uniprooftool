import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoaderService {
  private requestCount = 0;
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$: Observable<boolean> = this.loadingSubject.asObservable();

  /**
   * Check if any HTTP request is in progress
   * @returns True if loading, false otherwise
   */
  isLoading(): boolean {
    return this.loadingSubject.getValue();
  }

  /**
   * Increment the request counter and set loading to true
   */
  show(): void {
    this.requestCount++;
    console.log(`[LoaderService] Request started. Active requests: ${this.requestCount}`);
    this.loadingSubject.next(true);
  }

  /**
   * Decrement the request counter and set loading to false when count reaches 0
   */
  hide(): void {
    this.requestCount--;
    console.log(`[LoaderService] Request completed. Active requests: ${this.requestCount}`);
    
    if (this.requestCount <= 0) {
      this.requestCount = 0;
      this.loadingSubject.next(false);
    }
  }

  /**
   * Reset the loader state
   */
  reset(): void {
    this.requestCount = 0;
    this.loadingSubject.next(false);
  }
}
