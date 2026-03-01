import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
@Injectable({ providedIn: 'root' })
export class ArticleService {
  constructor(private http: HttpClient) {}
  getArticleXML(): Observable<string> {
    return this.http.get('mock/sampleJATS.xml', { responseType: 'text' });
  }
}