import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LoaderComponent } from './components/loader/loader';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('Thomson Digital - Uniproof Tool');

  constructor(private http: HttpClient) {}

  testLogin() {
    return this.http.get(
      'http://localhost:8080/apt-tool/api/v1/documents/2/versions/latest',
      { withCredentials: true }
    );
  }

  // ngOnInit() { 
  //   this.testLogin().subscribe(
  //     response => {
  //       console.log('User info:', response);
  //     },
  //     error => {
  //       console.error('Failed to fetch user info:', error);
  //     }
  //   );
  // }

}
