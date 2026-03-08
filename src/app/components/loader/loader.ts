import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoaderService } from '../../services/loader.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loader.html',
  styleUrl: './loader.css'
})
export class LoaderComponent implements OnInit {
  isLoading$: Observable<boolean>;

  constructor(private loaderService: LoaderService) {
    this.isLoading$ = this.loaderService.loading$;
  }

  ngOnInit(): void {
    console.log('[LoaderComponent] Loader component initialized');
  }
}
