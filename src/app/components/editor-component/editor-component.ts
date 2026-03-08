import { Component, Input, OnChanges, OnDestroy, OnInit, AfterViewInit, ViewEncapsulation, ChangeDetectorRef, NgZone, ChangeDetectionStrategy, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEditorModule, Editor, Toolbar, NgxEditorFloatingMenuComponent } from 'ngx-editor';
import { CommentService } from '../../services/comment.service';
import { jatsToHtmlMaster } from '../../utils/jats-to-html';
import { htmlToJatsWithTemplate } from '../../utils/html-to-jats';
import { ArticleService } from '../../services/article.service';
import { FigureMetadata, extractFiguresFromXml } from './figure.model';
// 🔹 Table schema & PM plugins
import { Schema, Node as PMNode, Fragment, DOMSerializer, Mark } from 'prosemirror-model';
import { EditorState, Transaction } from 'prosemirror-state';
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
import { imageSelectionPlugin } from './image-selection-plugin';
@Component({
  selector: 'app-editor-component',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEditorModule],
  templateUrl: './editor-component.html',
  styleUrls: ['./editor-component.css'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditorComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {

  @Input() documentId: string | null = null;
  @Input() documentDetails: any = null;

  htmlContent = '';
  private originalJatsXml = '';
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
  // Citation modal state
  showCitationModal = false;
  citationForm = { id: '', label: '' };
  selectedCitationText = '';
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
   * Open citation modal and capture selected text
   */
  openCitationModal(): void {
    const { selection } = this.editor.view.state;
    const { from, to } = selection;
    
    if (from !== to) {
      // Get the selected text
      const selectedNode = this.editor.view.state.doc.textBetween(from, to);
      this.selectedCitationText = selectedNode;
      this.citationForm.label = selectedNode; // Pre-fill label with selected text
    } else {
      this.selectedCitationText = '';
      this.citationForm.label = '';
    }
    
    this.showCitationModal = true;
    this.cdr.markForCheck();
  }

  /**
   * Close citation modal and reset form
   */
  closeCitationModal(): void {
    this.showCitationModal = false;
    this.citationForm = { id: '', label: '' };
    this.selectedCitationText = '';
    this.cdr.markForCheck();
  }

  /**
   * Insert citation mark at current selection or around selected text
   */
  insertCitation(): void {
    if (!this.citationForm.id || !this.citationForm.label) {
      alert('Please fill in both Citation ID and Label');
      return;
    }

    const { state, dispatch } = this.editor.view;
    const { selection, schema } = state;
    const { from, to } = selection;
    const citationMark = schema.marks['citation'].create({
      id: this.citationForm.id,
      label: this.citationForm.label
    });

    // Apply the citation mark to the selection
    let tr = state.tr.addMark(from, to, citationMark);

    // Dispatch the transaction
    dispatch(tr);

    // Close the modal and reset
    this.closeCitationModal();
    this.editor.view.focus();
  }
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

  getUpdatedJatsXml(): string {
    if (!this.originalJatsXml) {
      throw new Error('Original JATS XML is not loaded yet.');
    }

    const updatedHtml = this.getUpdatedHtmlContent();
    return htmlToJatsWithTemplate(updatedHtml, this.originalJatsXml);
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
        imageSelectionPlugin(),
      ],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['documentDetails']) {
      return;
    }

    const xml = this.extractJatsXmlFromDocumentDetails(changes['documentDetails'].currentValue);
    if (xml) {
      this.applyJatsXmlToEditor(xml);
    }
  }

  ngAfterViewInit(): void {
    // Delay content loading to ensure ngx-editor is fully initialized
    setTimeout(() => {
      const xmlFromDetails = this.extractJatsXmlFromDocumentDetails(this.documentDetails);
      if (xmlFromDetails) {
        this.applyJatsXmlToEditor(xmlFromDetails);
        return;
      }

      // When editing a routed document, wait for parent-provided API payload instead of loading mock XML.
      if (this.documentId) {
        console.warn('[EditorComponent] Waiting for parent documentDetails response for documentId:', this.documentId);
        return;
      }

      this.articleService.getArticleXML().subscribe({
        next: (xml) => {
          this.applyJatsXmlToEditor(xml);
        },
        error: (err) => console.error('Error loading article XML', err)
      });
    }, 100);
    this.cdr.detectChanges();
  }

  private applyJatsXmlToEditor(xml: string): void {
    if (!xml || xml === this.originalJatsXml) {
      return;
    }

    this.originalJatsXml = xml;
    this.htmlContent = jatsToHtmlMaster(xml);
    const figures = extractFiguresFromXml(xml);
    this.figuresExtracted.emit(figures);
    this.cdr.markForCheck();
  }

  private extractJatsXmlFromDocumentDetails(details: any): string | null {
    if (!details) {
      return null;
    }

    if (typeof details === 'string') {
      const trimmed = details.trim();
      return trimmed.startsWith('<') ? trimmed : null;
    }

    const candidateKeys = [
      'jatsXml',
      'jatsXML',
      'xml',
      'XML',
      'xmlContent',
      'articleXml',
      'documentXml',
      'sourceXml',
      'contentXml',
      'content',
      'jats',
      'documentContent'
    ];

    for (const key of candidateKeys) {
      const value = details?.[key];
      if (typeof value === 'string' && value.trim().startsWith('<')) {
        return value;
      }
    }

    const nestedKeys = ['latestVersion', 'version', 'documentVersion', 'data', 'payload'];
    for (const key of nestedKeys) {
      const nested = details?.[key];
      if (nested) {
        const nestedXml = this.extractJatsXmlFromDocumentDetails(nested);
        if (nestedXml) {
          return nestedXml;
        }
      }
    }

    return null;
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
/*
http://localhost:8080/apt-tool/api/v1/attachments/upload?documentId=2  (documentId Param) - Payload: FormData with file field
http://localhost:8080/apt-tool/api/v1/documents/2/saveNewVersion (documentId Param) (Payload: { "xmlContent": "string" })
{
  "xmlContent": "string"
}
*/