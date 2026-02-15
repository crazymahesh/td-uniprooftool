import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private showCommentFormSource = new Subject<void>();
  showCommentForm$ = this.showCommentFormSource.asObservable();

  triggerAddComment() {
    this.showCommentFormSource.next();
  }
}
