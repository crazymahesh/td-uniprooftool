import { CommonModule } from '@angular/common';
import { Component, ViewEncapsulation } from '@angular/core';
import { EditorComponent } from '../../components/editor-component/editor-component';
@Component({
  standalone: true,
  selector: 'app-editor-view',
  imports: [CommonModule, EditorComponent],
  templateUrl: './editor-view.html',
  styleUrls: ['./editor-view.css'],
  encapsulation: ViewEncapsulation.None,
})
export class EditorView {
  constructor() { }
}
