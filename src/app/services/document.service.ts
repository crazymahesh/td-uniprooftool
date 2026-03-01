import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { JatsConverterService } from './jats-converter.service';

interface Document {
  id: string;
  title: string;
  html: string;
  jatsXml?: string;
}

/**
 * Service to manage document loading and conversion
 * Currently supports loading from mock folder, can be extended to use backend APIs
 */
@Injectable({
  providedIn: 'root'
})
export class DocumentService {

  private mockFolder = '/mock';
  private fallbackPaths = [
    '/mock',
    'mock',
    './mock',
    'public/mock'
  ];

  constructor(
    private http: HttpClient,
    private jatsConverter: JatsConverterService
  ) { }

  /**
   * Load a document from the mock folder
   * @param filename The XML filename (e.g., 'sampleJATS.xml')
   * @returns Observable containing the document with HTML content
   */
  loadDocumentFromMock(filename: string): Observable<Document> {
    const primaryUrl = `${this.mockFolder}/${filename}`;
    
    console.log(`[DocumentService] Attempting to load: ${primaryUrl}`);

    return this.http.get(primaryUrl, { responseType: 'text' }).pipe(
      map(jatsXml => {
        console.log(`[DocumentService] Successfully fetched from: ${primaryUrl}`);
        const html = this.jatsConverter.convertJatsToHtml(jatsXml);
        return {
          id: filename,
          title: this.extractTitle(jatsXml),
          html,
          jatsXml
        };
      }),
      catchError(error => {
        console.error(`[DocumentService] Failed to load from ${primaryUrl}:`, error);
        console.log(`[DocumentService] Trying fallback paths...`);
        return this.tryFallbackPaths(filename, this.fallbackPaths);
      })
    );
  }

  /**
   * Try alternative paths for loading the document
   */
  private tryFallbackPaths(filename: string, paths: string[], index: number = 0): Observable<Document> {
    if (index >= paths.length) {
      return of({
        id: filename,
        title: 'Error Loading Document',
        html: `<p>Unable to load document <code>${filename}</code> from any available path. Tried: ${paths.map(p => p + '/' + filename).join(', ')}</p>`,
        jatsXml: ''
      });
    }

    const currentPath = paths[index];
    const url = `${currentPath}/${filename}`;

    console.log(`[DocumentService] Trying fallback path: ${url}`);

    return this.http.get(url, { responseType: 'text' }).pipe(
      map(jatsXml => {
        console.log(`[DocumentService] Successfully fetched from fallback: ${url}`);
        const html = this.jatsConverter.convertJatsToHtml(jatsXml);
        return {
          id: filename,
          title: this.extractTitle(jatsXml),
          html,
          jatsXml
        };
      }),
      catchError(error => {
        console.log(`[DocumentService] Fallback path ${url} failed, trying next...`);
        return this.tryFallbackPaths(filename, paths, index + 1);
      })
    );
  }

  /**
   * Load a document from a backend API endpoint
   * @param apiEndpoint The API endpoint URL
   * @returns Observable containing the document with HTML content
   */
  loadDocumentFromAPI(apiEndpoint: string): Observable<Document> {
    return this.http.get<any>(apiEndpoint).pipe(
      map(response => {
        // Assuming the API returns an object with 'jatsXml' or 'xml' property
        const jatsXml = response.jatsXml || response.xml || '';
        const html = this.jatsConverter.convertJatsToHtml(jatsXml);
        return {
          id: response.id || 'api-document',
          title: response.title || this.extractTitle(jatsXml),
          html,
          jatsXml
        };
      }),
      catchError(error => {
        console.error('Error loading document from API:', error);
        return of({
          id: 'api-error',
          title: 'Error Loading Document',
          html: '<p>Unable to load document from the server. Please try again later.</p>',
          jatsXml: ''
        });
      })
    );
  }

  /**
   * Get list of available mock documents
   * @returns Observable array of available document filenames
   */
  getAvailableMockDocuments(): Observable<string[]> {
    // This is a placeholder - in a real application, you might fetch this from an API
    // or configure it from a constant
    return of([
      'sampleJATS.xml',
      'sample-article.xml',
    ]);
  }

  /**
   * Extract title from JATS XML
   */
  private extractTitle(jatsXml: string): string {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(jatsXml, 'application/xml');
      const titleElement = xmlDoc.querySelector('article-title');
      return titleElement?.textContent || 'Untitled Document';
    } catch (error) {
      return 'Untitled Document';
    }
  }
}
