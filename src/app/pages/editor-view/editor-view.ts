import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { EditorComponent } from '../../components/editor-component/editor-component';
import { CommentService } from '../../services/comment.service';
import { TrackChangesService } from '../../services/track-changes.service';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
@Component({
  standalone: true,
  selector: 'app-editor-view',
  imports: [CommonModule, EditorComponent, FormsModule],
  templateUrl: './editor-view.html',
  styleUrls: ['./editor-view.css'],
  encapsulation: ViewEncapsulation.None,
})
export class EditorView implements OnInit, OnDestroy {
  showNewCommentForm = false;
  newCommentText = '';
  trackedChanges: any[] = [];
  private subscription: Subscription = new Subscription();

  constructor(
    private commentService: CommentService,
    private trackChangesService: TrackChangesService
  ) { }

  ngOnInit(): void {
    this.subscription.add(
      this.commentService.showCommentForm$.subscribe(() => {
        this.showNewCommentForm = true;
      })
    );

    this.subscription.add(
      this.trackChangesService.changes$.subscribe(changes => {
        this.trackedChanges = changes;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  toggleAddComment(): void {
    this.showNewCommentForm = !this.showNewCommentForm;
    if (!this.showNewCommentForm) {
      this.newCommentText = '';
    }
  }

  postComment(): void {
    if (this.newCommentText.trim()) {
      console.log('Posting comment:', this.newCommentText);
      // Logic for posting comment would go here
      this.newCommentText = '';
      this.showNewCommentForm = false;
    }
  }

  cancelComment(): void {
    this.newCommentText = '';
    this.showNewCommentForm = false;
  }

  acceptChange(id: string): void {
    this.trackChangesService.acceptChange(id);
  }

  rejectChange(id: string): void {
    this.trackChangesService.rejectChange(id);
  }
}
