import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEditorModule, Editor, Toolbar, NgxEditorFloatingMenuComponent } from 'ngx-editor';

// 🔹 Table schema & PM plugins
import { Schema, Node as PMNode, Fragment } from 'prosemirror-model';
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
})
export class EditorComponent implements OnInit, OnDestroy{

  htmlContent = `<h4>Chapter 1: The Beginning</h4><h2 class="h4 fw-bold mb-3">1.1 Introduction to Neural Networks</h2>
                <p class="mb-3">Neural networks are a subset of machine learning and are at the heart of deep
                    learning algorithms. Their name and structure are inspired by the human brain, mimicking the way
                    that biological neurons signal to one another.</p>

                <p class="mb-4">Artificial neural networks (ANNs) are comprised of node layers, containing an input
                    layer, one or more hidden layers, and an output layer. Each node, or artificial neuron, connects
                    to another and has an associated weight and threshold. If the output of any individual node is
                    above the specified threshold value, that node is activated, sending data to the next layer of
                    the network. Otherwise, no data is passed along to the next layer of the network.</p>

                <h3 class="h5 fw-bold mb-3">Key Components</h3>
                <ul class="mb-4">
                    <li class="mb-1"><strong>Input Layer:</strong> Receives initial data for the neural network.
                    </li>
                    <li class="mb-1"><strong>Hidden Layers:</strong> Intermediate layers where data processing
                        happens.</li>
                    <li class="mb-1"><strong>Output Layer:</strong> Produces the final result for given inputs.</li>
                    <li class="mb-1"><strong>Weights and Biases:</strong> Parameters that are adjusted during
                        training.</li>
                </ul>

                <h3 class="h5 fw-bold mb-3">Training Process</h3>
                <ol class="mb-4">
                    <li class="mb-2"><strong>Forward Propagation:</strong> Data flows through the network to get an
                        output.</li>
                    <li class="mb-2"><strong>Loss Calculation:</strong> The difference between the predicted output
                        and the actual output is calculated.</li>
                    <li class="mb-2"><strong>Backpropagation:</strong> The error is propagated back through the
                        network to update weights.</li>
                    <li class="mb-2"><strong>Iteration:</strong> Steps 1-3 are repeated until the model converges.
                    </li>
                </ol>

                <h3 class="h5 fw-bold mb-3">Performance Comparison</h3>
                <p class="mb-3">The following table helps to visualize the performance differences between various
                    activation functions used in neural networks.</p>

                <div class="table-responsive mb-4">
                    <table class="table table-bordered table-hover">
                        <thead class="table-light">
                            <tr>
                                <th>Activation Function</th>
                                <th>Range</th>
                                <th>Smoothness</th>
                                <th>Computational Cost</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Sigmoid</td>
                                <td>(0, 1)</td>
                                <td>Smooth</td>
                                <td>High</td>
                            </tr>
                            <tr>
                                <td>Tanh</td>
                                <td>(-1, 1)</td>
                                <td>Smooth</td>
                                <td>High</td>
                            </tr>
                            <tr>
                                <td>ReLU (Rectified Linear Unit)</td>
                                <td>[0, infinity)</td>
                                <td>Not smooth at 0</td>
                                <td>Low</td>
                            </tr>
                            <tr>
                                <td>Leaky ReLU</td>
                                <td>(-infinity, infinity)</td>
                                <td>Not smooth at 0</td>
                                <td>Low</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h3 class="h5 fw-bold mb-3">Network Architecture</h3>
                <p class="mb-3">To better understand the flow of data, let refer to the visual representation below.
                </p>

                <figure class="figure border p-2 bg-light w-100 text-center mb-4" id="fig5-1">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Artificial_neural_network.svg/1200px-Artificial_neural_network.svg.png"
                        class="figure-img img-fluid rounded" alt="Diagram of a simple feedforward neural network"
                        style="max-height: 300px;">
                    <figcaption class="figure-caption text-center fw-bold">Figure 5.1: A simple feedforward neural
                        network architecture.</figcaption>
                </figure>

                <p class="mb-4">As visually depicted in <a href="#fig5-1"
                        class="text-primary text-decoration-none">Figure 5.1</a>, the information usually moves in
                    only one direction, forward, from the input nodes, through the hidden nodes (if any) and to the
                    output nodes. There are no cycles or loops in the network.</p>

                <p class="text-muted fst-italic mb-5">End of section 1.1</p>

                <h2 class="h4 fw-bold mb-3">1.2 Convolutional Neural Networks (CNNs)</h2>
                <p class="mb-3">Convolutional Neural Networks, or <em>CNNs</em>, are a specialized type of neural
                    network designed to process data that has a known grid-like topology, such as time-series data
                    (1-D grid) and image data (2-D grid). They have been instrumental in advancing the field of
                    computer vision.</p>

                <p class="mb-4">The defining feature of a CNN is the <span
                        class="text-decoration-underline">convolutional layer</span>. Unlike fully connected layers
                    where every input connects to every output, convolutional layers use filters (or kernels) to
                    scan the input and detect local patterns like edges, textures, and shapes.</p>

                <h3 class="h5 fw-bold mb-3">architectural Building Blocks</h3>
                <ul class="mb-4">
                    <li class="mb-1"><strong>Convolutional Layer:</strong> Applies filters to the input to create
                        feature maps.</li>
                    <li class="mb-1"><strong>Pooling Layer:</strong> Reduces the spatial dimensions (width, height)
                        of the input volume for the next convolutional layer. Common types include <em>Max
                            Pooling</em> and <em>Average Pooling</em>.</li>
                    <li class="mb-1"><strong>Fully Connected Layer:</strong> Neurons connect to all neurons in the
                        preceding layer, typically used at the end for classification.</li>
                </ul>

                <figure class="figure border p-2 bg-light w-100 text-center mb-4" id="fig5-2">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Typical_cnn.png/1200px-Typical_cnn.png"
                        class="figure-img img-fluid rounded" alt="Diagram typical CNN architecture"
                        style="max-height: 300px;">
                    <figcaption class="figure-caption text-center fw-bold">Figure 5.2: A typical CNN architecture
                        showing convolution and pooling layers.</figcaption>
                </figure>

                <p class="mb-5">As illustrated in <a href="#fig5-2" class="text-primary text-decoration-none">Figure
                        5.2</a>, the image goes through a series of convolutions and pooling operations before being
                    flattened and passed to a fully connected layer for the final prediction.</p>

                <h2 class="h4 fw-bold mb-3">1.3 Natural Language Processing (NLP)</h2>
                <p class="mb-3">Natural Language Processing (NLP) is a subfield of linguistics, computer science,
                    and artificial intelligence concerned with the interactions between computers and human
                    language. In particular, it focuses on how to program computers to process and analyze large
                    amounts of natural language data.</p>

                <h3 class="h5 fw-bold mb-3">Evolution of NLP Models</h3>
                <p class="mb-3">The field has moved from Recurrent Neural Networks (RNNs) to the more modern
                    Transformer architecture, which allows for parallel processing of data.</p>

                <div class="table-responsive mb-5">
                    <table class="table table-striped table-bordered">
                        <thead class="table-dark">
                            <tr>
                                <th>Feature</th>
                                <th>Recurrent Neural Networks (RNN)</th>
                                <th>Transformers</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>Parallelization</strong></td>
                                <td>Sequential processing (Hard to parallelize)</td>
                                <td>Parallel processing (Highly scalable)</td>
                            </tr>
                            <tr>
                                <td><strong>Long-range Dependencies</strong></td>
                                <td>Struggles with long sequences (Vanishing gradient)</td>
                                <td>Handles long dependencies well (Self-attention)</td>
                            </tr>
                            <tr>
                                <td><strong>Training Time</strong></td>
                                <td>Slow for long sequences</td>
                                <td>Faster due to parallelization</td>
                            </tr>
                            <tr>
                                <td><strong>Key Mechanism</strong></td>
                                <td>Recurrence</td>
                                <td>Attention Mechanism</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h2 class="h3 fw-bold mb-4 border-bottom pb-2">References</h2>
                <ol class="mb-5 small text-muted">
                    <li class="mb-2" id="ref1">LeCun, Y., Bengio, Y., & Hinton, G. (2015). Deep learning.
                        <em>Nature</em>, 521(7553), 436-444.
                    </li>
                    <li class="mb-2" id="ref2">Goodfellow, I., Bengio, Y., & Courville, A. (2016). <em>Deep
                            Learning</em>. MIT Press.</li>
                    <li class="mb-2" id="ref3">Vaswani, A., et al. (2017). Attention is all you need. In
                        <em>Advances in neural information processing systems</em> (pp. 5998-6008).
                    </li>
                    <li class="mb-2" id="ref4">Hochreiter, S., & Schmidhuber, J. (1997). Long short-term memory.
                        <em>Neural computation</em>, 9(8), 1735-1780.
                    </li>
                    <li class="mb-2" id="ref5">Rumelhart, D. E., Hinton, G. E., & Williams, R. J. (1986). Learning
                        representations by back-propagating errors. <em>Nature</em>, 323(6088), 533-536.</li>
                </ol>

                <hr class="my-5">
                <p class="text-center text-muted small"><em>Draft Version 1.0 - Last modified by Author</em></p>`;

  editor!: Editor;
  schema!: Schema;

  toolbar: Toolbar = [
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

  /** ---------- Table commands ---------- */

  insertTable(rows = 3, cols = 3, withHeaderRow = true): void {
    const state = this.editor.view.state;
    const view = this.editor.view;
    const table = this.buildTable(this.schema, rows, cols, withHeaderRow);
    const tr = state.tr.replaceSelectionWith(table).scrollIntoView();
    view.dispatch(tr);
    view.focus();
  }

  addRowAfter(): void {
    const state = this.editor.view.state;
    const view = this.editor.view;
    addRowAfter(state, view.dispatch);
    view.focus();
  }

  addColumnAfter(): void {
    const state = this.editor.view.state;
    const view = this.editor.view;
    addColumnAfter(state, view.dispatch);
    view.focus();
  }

  deleteRow(): void {
    const state = this.editor.view.state;
    const view = this.editor.view;
    pmDeleteRow(state, view.dispatch);
    view.focus();
  }

  deleteColumn(): void {
    const state = this.editor.view.state;
    const view = this.editor.view;
    pmDeleteColumn(state, view.dispatch);
    view.focus();
  }

  deleteTable(): void {
    const state = this.editor.view.state;
    const view = this.editor.view;
    pmDeleteTable(state, view.dispatch);
    view.focus();
  }

  mergeCells(): void {
    const state = this.editor.view.state;
    const view = this.editor.view;
    pmMergeCells(state, view.dispatch);
    view.focus();
  }

  splitCell(): void {
    const state = this.editor.view.state;
    const view = this.editor.view;
    pmSplitCell(state, view.dispatch);
    view.focus();
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
