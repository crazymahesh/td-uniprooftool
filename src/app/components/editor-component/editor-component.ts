import { Component, OnDestroy, OnInit, AfterViewInit, ViewEncapsulation, ChangeDetectorRef, NgZone, ChangeDetectionStrategy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEditorModule, Editor, Toolbar, NgxEditorFloatingMenuComponent } from 'ngx-editor';
import { CommentService } from '../../services/comment.service';
import { jatsToHtmlMaster } from '../../utils/jats-to-html';
import { ArticleService } from '../../services/article.service';
import { FigureMetadata, extractFiguresFromXml } from './figure.model';
// 🔹 Table schema & PM plugins
import { Schema, Node as PMNode, Fragment, DOMSerializer } from 'prosemirror-model';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import {
  columnResizing,
  tableEditing,
  addRowAfter,
  addColumnAfter,
  deleteTable as pmDeleteTable,
  deleteRow as pmDeleteRow,
  deleteColumn as pmDeleteColumn,
  mergeCells as pmMergeCells,
  splitCell as pmSplitCell,
  goToNextCell,
} from 'prosemirror-tables';

import { tableSchema } from './editor-schema';

@Component({
  selector: 'app-editor-component',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEditorModule],
  templateUrl: './editor-component.html',
  styleUrl: './editor-component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditorComponent implements OnInit, AfterViewInit, OnDestroy {

  htmlContent = '';

  // htmlContent = `<h4>Chapter 1: The Beginning</h4><h2 class="h4 fw-bold mb-3">1.1 Introduction to Neural Networks</h2>
  //               <p class="mb-3">Neural networks are a subset of machine learning and are at the heart of deep
  //                   learning algorithms. Their name and structure are inspired by the human brain, mimicking the way
  //                   that biological neurons signal to one another.</p>

  //               <p class="mb-4">Artificial neural networks (ANNs) are comprised of node layers, containing an input
  //                   layer, one or more hidden layers, and an output layer. Each node, or artificial neuron, connects
  //                   to another and has an associated weight and threshold. If the output of any individual node is
  //                   above the specified threshold value, that node is activated, sending data to the next layer of
  //                   the network. Otherwise, no data is passed along to the next layer of the network.</p>

  //               <h3 class="h5 fw-bold mb-3">Key Components</h3>
  //               <ul class="mb-4">
  //                   <li class="mb-1"><strong>Input Layer:</strong> Receives initial data for the neural network.
  //                   </li>
  //                   <li class="mb-1"><strong>Hidden Layers:</strong> Intermediate layers where data processing
  //                       happens.</li>
  //                   <li class="mb-1"><strong>Output Layer:</strong> Produces the final result for given inputs.</li>
  //                   <li class="mb-1"><strong>Weights and Biases:</strong> Parameters that are adjusted during
  //                       training.</li>
  //               </ul>

  //               <h3 class="h5 fw-bold mb-3\">Training Process</h3>
  //               <ol class="mb-4">
  //                   <li class="mb-2"><strong>Forward Propagation:</strong> Data flows through the network to get an
  //                       output.</li>
  //                   <li class="mb-2"><strong>Loss Calculation:</strong> The difference between the predicted output
  //                       and the actual output is calculated.</li>
  //                   <li class="mb-2"><strong>Backpropagation:</strong> The error is propagated back through the
  //                       network to update weights.</li>
  //                   <li class="mb-2"><strong>Iteration:</strong> Steps 1-3 are repeated until the model converges.
  //                   </li>
  //               </ol>

  //               <h3 class="h5 fw-bold mb-3">Performance Comparison</h3>
  //               <p class="mb-3">The following table helps to visualize the performance differences between various
  //                   activation functions used in neural networks.</p>

  //               <div class="table-responsive mb-4">
  //                   <table class="table table-bordered table-hover">
  //                       <thead class="table-light">
  //                           <tr>
  //                               <th>Activation Function</th>
  //                               <th>Range</th>
  //                               <th>Smoothness</th>
  //                               <th>Computational Cost</th>
  //                           </tr>
  //                       </thead>
  //                       <tbody>
  //                           <tr>
  //                               <td>Sigmoid</td>
  //                               <td>(0, 1)</td>
  //                               <td>Smooth</td>
  //                               <td>High</td>
  //                           </tr>
  //                           <tr>
  //                               <td>Tanh</td>
  //                               <td>(-1, 1)</td>
  //                               <td>Smooth</td>
  //                               <td>High</td>
  //                           </tr>
  //                           <tr>
  //                               <td>ReLU (Rectified Linear Unit)</td>
  //                               <td>[0, infinity)</td>
  //                               <td>Not smooth at 0</td>
  //                               <td>Low</td>
  //                           </tr>
  //                       </tbody>
  //                   </table>
  //               </div>`;
  
  editor!: Editor;
  schema!: Schema;
  private cd = ChangeDetectionStrategy.OnPush;
  toolbar: Toolbar = [
    ['undo', 'redo'],
    ['bold', 'italic', 'underline'],
    ['subscript', 'superscript'],
    ['code', 'blockquote'],
    ['ordered_list', 'bullet_list'],
    [{ heading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] }],
    ['link', 'image'],
    ['text_color', 'background_color'],
    ['align_left', 'align_center', 'align_right', 'align_justify'],
  ];

  floatingToolbar: Toolbar = [
    ['bold', 'italic', 'underline'],
    ['subscript', 'superscript'],
    ['link'],
    ['ordered_list', 'bullet_list'],
  ];

  // Table dropdown state
  showTableDropdown = false;
  gridRows = 8;
  gridCols = 10;
  hoveredRow = 0;
  hoveredCol = 0;

  // Emit figures to parent component
  @Output() figuresExtracted = new EventEmitter<FigureMetadata[]>();

  constructor(
    private commentService: CommentService,
    private articleService: ArticleService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) { }

  addComment(): void {
    this.commentService.triggerAddComment();
  }

  /**
   * Get the current HTML content from the ProseMirror editor state
   * This captures all edits made by the user
   */
  getUpdatedHtmlContent(): string {
    if (!this.editor || !this.editor.view) {
      console.warn('Editor not initialized');
      return this.htmlContent;
    }

    try {
      // Convert ProseMirror state to HTML using DOMSerializer
      const serializer = DOMSerializer.fromSchema(this.schema);
      const dom = serializer.serializeFragment(this.editor.view.state.doc.content);
      const container = document.createElement('div');
      container.appendChild(dom);
      const html = container.innerHTML;
      return html || this.htmlContent;
    } catch (error) {
      console.error('Error getting HTML from editor:', error);
      return this.htmlContent;
    }
  }

  ngOnInit(): void {
    this.schema = tableSchema;

    this.editor = new Editor({
      schema: this.schema,
      history: true,
      keyboardShortcuts: true,
      inputRules: true,
      // Table editing & resizing + useful keymaps
      plugins: [
        columnResizing({ handleWidth: 6, lastColumnResizable: true }),
        tableEditing(),
        keymap({
          Tab: goToNextCell(1),
          'Shift-Tab': goToNextCell(-1),
        }),
        keymap(baseKeymap),
      ],
    });
  }

  ngAfterViewInit(): void {
    // Delay content loading to ensure ngx-editor is fully initialized
    setTimeout(() => {
      this.articleService.getArticleXML().subscribe({
        next: (xml) => {
          this.htmlContent = jatsToHtmlMaster(xml);
          // Extract figures from XML and emit to parent
          const figures = extractFiguresFromXml(xml);
          this.figuresExtracted.emit(figures);
          this.cdr.markForCheck();
        },
        error: (err) => console.error('Error loading article XML', err)
      });
    }, 100);
    this.cdr.detectChanges();
  }



  ngOnDestroy(): void {
    this.editor?.destroy();
  }

  /** ---------- Table dropdown methods ---------- */

  toggleTableDropdown(): void {
    this.showTableDropdown = !this.showTableDropdown;
  }

  closeTableDropdown(): void {
    this.showTableDropdown = false;
    this.hoveredRow = 0;
    this.hoveredCol = 0;
  }

  onGridCellHover(row: number, col: number): void {
    this.hoveredRow = row;
    this.hoveredCol = col;
  }

  onGridCellClick(row: number, col: number): void {
    this.insertTable(row, col, true);
    this.closeTableDropdown();
  }

  getGridLabel(): string {
    if (this.hoveredRow === 0 || this.hoveredCol === 0) {
      return 'Insert Table';
    }
    return `${this.hoveredRow} × ${this.hoveredCol}`;
  }

  insertTable(rows = 3, cols = 3, withHeaderRow = true): void {
    const { state } = this.editor.view;
    const view = this.editor.view;
    const table = this.buildTable(this.schema, rows, cols, withHeaderRow);
    const tr = state.tr.replaceSelectionWith(table).scrollIntoView();
    view.dispatch(tr);
    view.focus();
  }

  addRowAfter(): void {
    const { state, dispatch } = this.editor.view;
    addRowAfter(state, dispatch);
    this.editor.view.focus();
  }

  addColumnAfter(): void {
    const { state, dispatch } = this.editor.view;
    addColumnAfter(state, dispatch);
    this.editor.view.focus();
  }

  deleteRow(): void {
    const { state, dispatch } = this.editor.view;
    pmDeleteRow(state, dispatch);
    this.editor.view.focus();
  }

  deleteColumn(): void {
    const { state, dispatch } = this.editor.view;
    pmDeleteColumn(state, dispatch);
    this.editor.view.focus();
  }

  deleteTable(): void {
    const { state, dispatch } = this.editor.view;
    pmDeleteTable(state, dispatch);
    this.editor.view.focus();
  }

  mergeCells(): void {
    const { state, dispatch } = this.editor.view;
    pmMergeCells(state, dispatch);
    this.editor.view.focus();
  }

  splitCell(): void {
    const { state, dispatch } = this.editor.view;
    pmSplitCell(state, dispatch);
    this.editor.view.focus();
  }

  /** Build a PM table node (optionally with a header row) */
  private buildTable(schema: Schema, rows: number, cols: number, withHeaderRow: boolean): PMNode {
    const { table, table_row, table_cell, table_header } = schema.nodes;

    const mkCell = (header = false) =>
      (header ? table_header : table_cell).createAndFill()!;

    const mkRow = (isHeader = false) => {
      const cells = Array.from({ length: cols }, () => mkCell(isHeader));
      return table_row.create(null, Fragment.from(cells));
    };

    const rowNodes: PMNode[] = [];
    if (withHeaderRow) rowNodes.push(mkRow(true));
    for (let i = 0; i < rows - (withHeaderRow ? 1 : 0); i++) {
      rowNodes.push(mkRow(false));
    }

    return table.create(null, Fragment.from(rowNodes));
  }

}
