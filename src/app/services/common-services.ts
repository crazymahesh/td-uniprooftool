import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { LoaderComponent } from '../components/loader/loader';
import { APP_CONSTANTS } from '../app.constants';
@Injectable({
  providedIn: 'root',
})
export class CommonServices {
  private readonly CURRENT_DOC_API_URL = `${APP_CONSTANTS.API_BASE_URL}/projects/current`;
  constructor(private http: HttpClient) {}
  getCurrentDocument(): Observable<any> {
    return this.http.get(this.CURRENT_DOC_API_URL, { withCredentials: true }).pipe(
      tap((response) => {
        console.log('[CommonServices] Current document info:', response);
      }), 
      catchError((error) => {
        console.error('[CommonServices] Failed to fetch current document info:', error);
        return of(null); 
      })
    );
  }

  getDocumentDetails(documentId: any): Observable<any> { 
    const url = `${APP_CONSTANTS.API_BASE_URL}/documents/${documentId}/versions/latest`;
    return this.http.get(url, { withCredentials: true }).pipe(
      tap((response) => {
        console.log(`[CommonServices] Document details for ${documentId}:`, response);
      }), 
      catchError((error) => {
        console.error(`[CommonServices] Failed to fetch document details for ${documentId}:`, error);
        return of(null); 
      })
    );  
  }
}
