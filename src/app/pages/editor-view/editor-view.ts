import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, OnDestroy, ViewEncapsulation, ViewChild, NgZone, ChangeDetectorRef } from '@angular/core';
import { EditorComponent } from '../../components/editor-component/editor-component';
import { CommentService } from '../../services/comment.service';
import { FigureMetadata } from '../../components/editor-component/figure.model';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LoaderService } from '../../services/loader.service';
import { CommonServices } from '../../services/common-services';

@Component({
  standalone: true,
  selector: 'app-editor-view',
  imports: [CommonModule, EditorComponent, FormsModule],
  templateUrl: './editor-view.html',
  styleUrls: ['./editor-view.css'],
  encapsulation: ViewEncapsulation.None
})
export class EditorView implements OnInit, OnDestroy {
  showNewCommentForm = false;
  newCommentText = '';
  figures: FigureMetadata[] = [];
  saveStatusText = 'Saved';
  lastSavedAt: Date | null = null;
  documentId: string | null = null;
  documentDetails: any = null;
  private commonServices = inject(CommonServices);
  // Search functionality
  searchText = '';
  searchResults: any[] = [];
  selectedResultIndex = -1;
  searchFilters = {
    matchCase: false,
    wholeWord: false,
    useRegex: false
  };
  
  private searchHighlightTimeout: any;
  private subscription: Subscription = new Subscription();

  @ViewChild(EditorComponent) editorComponent!: EditorComponent;

  constructor(
    private commentService: CommentService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.subscription.add(
      this.commentService.showCommentForm$.subscribe(() => {
        this.showNewCommentForm = true;
      })
    );

    this.subscription.add(
      this.route.paramMap.subscribe((params) => {
        const paramDocumentId = params.get('documentId');
        this.documentId = paramDocumentId;

        if (paramDocumentId) {
          this.loadDocumentDetails(paramDocumentId);
        }
      })
    );
  }

  private loadDocumentDetails(documentId: string): void {
    this.subscription.add(
      this.commonServices.getDocumentDetails(documentId).subscribe({
        next: (response: any) => {
          this.documentDetails = response;
          console.log('[EditorView] Loaded document details:', this.documentDetails);
        },
        error: (error: any) => {
          console.error('[EditorView] Failed to load document details:', error);
        }
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

  

  /**
   * Navigate to and highlight a figure in the editor
   */
  navigateToFigure(figureId: string): void {
    console.log('Navigating to figure:', figureId);
    
    // Defer DOM manipulation to next tick to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.ngZone.runOutsideAngular(() => {
        // Try multiple selectors to find the figure element
        let figureElement = document.querySelector(`[data-id="${figureId}"]`);
        
        if (!figureElement) {
          console.log('data-id not found, trying id attribute');
          figureElement = document.querySelector(`#${figureId}`);
        }

        if (!figureElement) {
          console.log('id not found, searching in ProseMirror editor');
          // Search within the ng-x editor's content area
          const editorContent = document.querySelector('.ProseMirror');
          if (editorContent) {
            figureElement = editorContent.querySelector(`[data-id="${figureId}"]`);
          }
          if (!figureElement && editorContent) {
            figureElement = editorContent.querySelector(`#${figureId}`);
          }
        }

        if (!figureElement) {
          console.warn('Figure element not found for ID:', figureId);
          console.log('Available figure elements:', document.querySelectorAll('figure'));
          return;
        }

        console.log('Found figure element:', figureElement);

        // Scroll the figure element into view
        try {
          figureElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Highlight the figure temporarily
          figureElement.classList.add('figure-highlight');
          setTimeout(() => {
            figureElement?.classList.remove('figure-highlight');
          }, 2000);

          console.log('Navigation successful');
        } catch (error) {
          console.error('Error during navigation:', error);
        }
      });
    }, 0);
  }

  /**
   * Handle figures extracted from editor component
   */
  onFiguresExtracted(figures: FigureMetadata[]): void {
    console.log('Figures extracted:', figures);
    console.log('Figure IDs:', figures.map(f => f.id));
    this.figures = figures;
  }

  /**
   * Handle search input change - highlights matches in real-time
   */
  onSearchInputChange(): void {
    // Clear existing timeout
    if (this.searchHighlightTimeout) {
      clearTimeout(this.searchHighlightTimeout);
    }

    // Immediately remove highlights when input changes
    this.removeAllHighlights();

    // If search text is empty, clear results immediately
    if (!this.searchText.trim()) {
      this.searchResults = [];
      this.selectedResultIndex = -1;
      return;
    }

    // Debounce the highlighting to avoid too frequent updates
    this.searchHighlightTimeout = setTimeout(() => {
      this.ngZone.run(() => {
        // Perform search and highlight
        this.performSearch();
        this.highlightAllMatches();
      });
    }, 300); // 300ms debounce
  }

  /**
   * Highlight all search matches in the editor
   */
  private highlightAllMatches(): void {
    const editorContent = document.querySelector('.ProseMirror');
    if (!editorContent || !this.searchText.trim()) {
      return;
    }

    const searchText = this.searchFilters.matchCase ? this.searchText : this.searchText.toLowerCase();
    
    // Walk through all text nodes
    const walker = document.createTreeWalker(
      editorContent,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentNode: Node | null;
    const nodesToReplace: Array<{node: Node, html: string}> = [];

    while ((currentNode = walker.nextNode())) {
      const origText = currentNode.textContent || '';
      let nodeText = this.searchFilters.matchCase ? origText : origText.toLowerCase();

      if (nodeText.includes(searchText)) {
        // Collect all matches
        const matches: Array<{start: number, end: number}> = [];
        let startIndex = 0;

        while (true) {
          const matchIndex = nodeText.indexOf(searchText, startIndex);
          if (matchIndex === -1) break;
    
          // Check whole word match if enabled
          if (this.searchFilters.wholeWord) {
            const charBefore = matchIndex > 0 ? nodeText[matchIndex - 1] : ' ';
            const charAfter = matchIndex + searchText.length < nodeText.length ? nodeText[matchIndex + searchText.length] : ' ';
            
            const isWordBoundaryBefore = !/\w/.test(charBefore);
            const isWordBoundaryAfter = !/\w/.test(charAfter);
            
            if (!isWordBoundaryBefore || !isWordBoundaryAfter) {
              startIndex = matchIndex + 1;
              continue;
            }
          }
    
          matches.push({ start: matchIndex, end: matchIndex + searchText.length });
          startIndex = matchIndex + 1;
        }

        // Build HTML with all matches highlighted
        if (matches.length > 0) {
          let highlightedHtml = '';
          let lastIndex = 0;

          matches.forEach((match, idx) => {
            highlightedHtml += this.escapeHtml(origText.substring(lastIndex, match.start));
            highlightedHtml += `<span class="search-highlight-inline" data-search-match="true" data-match-number="${idx}">` + 
                               this.escapeHtml(origText.substring(match.start, match.end)) + 
                               `</span>`;
            lastIndex = match.end;
          });

          highlightedHtml += this.escapeHtml(origText.substring(lastIndex));
          nodesToReplace.push({ node: currentNode, html: highlightedHtml });
        }
      }
    }

    // Replace nodes with highlighted versions
    nodesToReplace.forEach(item => {
      const span = document.createElement('span');
      span.innerHTML = item.html;
      if (item.node.parentElement) {
        item.node.parentElement.replaceChild(span, item.node);
      }
    });
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Remove all inline search highlights
   */
  private removeAllHighlights(): void {
    const editorContent = document.querySelector('.ProseMirror');
    if (!editorContent) {
      console.warn('Editor content not found');
      return;
    }

    // Find all highlight elements - convert to Array and reverse
    const highlightsToRemove = Array.from(
      editorContent.querySelectorAll('.search-highlight-inline, .search-highlight')
    ).reverse();
    
    if (highlightsToRemove.length > 0) {
      console.log(`Removing ${highlightsToRemove.length} highlight elements`);
      
      // Process in reverse order and with error handling
      highlightsToRemove.forEach(el => {
        try {
          const parent = el.parentElement;
          if (parent !== null) {
            const textNode = document.createTextNode(el.textContent || '');
            parent.replaceChild(textNode, el);
            // Only call normalize if parent still exists
            if (parent.parentElement !== null) {
              parent.normalize();
            }
          }
        } catch (error) {
          console.warn('Error removing highlight element:', error);
        }
      });
      
      console.log('Highlights removed successfully');
    } else {
      console.log('No highlights found to remove');
    }
  }

  /**
   * Perform search in the editor content
   */
  performSearch(): void {
    if (!this.searchText.trim()) {
      this.searchResults = [];
      this.selectedResultIndex = -1;
      return;
    }

    const editorContent = document.querySelector('.ProseMirror');
    if (!editorContent) {
      console.warn('Editor content not found');
      return;
    }

    this.searchResults = [];
    const searchText = this.searchFilters.matchCase ? this.searchText : this.searchText.toLowerCase();
    let matchCount = 0;
    
    // Get all text nodes from the editor
    const walker = document.createTreeWalker(
      editorContent,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentNode: Node | null;
    const textNodes: Node[] = [];

    while ((currentNode = walker.nextNode())) {
      textNodes.push(currentNode);
    }

    // Search through text nodes
    textNodes.forEach((node, index) => {
      const nodeText = this.searchFilters.matchCase ? node.textContent || '' : (node.textContent || '').toLowerCase();
      const origText = node.textContent || '';
      
      let startIndex = 0;
      while (true) {
        const matchIndex = nodeText.indexOf(searchText, startIndex);
        if (matchIndex === -1) break;

        // Check whole word match if enabled
        if (this.searchFilters.wholeWord) {
          const charBefore = matchIndex > 0 ? nodeText[matchIndex - 1] : ' ';
          const charAfter = matchIndex + searchText.length < nodeText.length ? nodeText[matchIndex + searchText.length] : ' ';
          
          const isWordBoundaryBefore = !/\w/.test(charBefore);
          const isWordBoundaryAfter = !/\w/.test(charAfter);
          
          if (!isWordBoundaryBefore || !isWordBoundaryAfter) {
            startIndex = matchIndex + 1;
            continue;
          }
        }

        // Get context (surrounding text)
        const contextStart = Math.max(0, matchIndex - 30);
        const contextEnd = Math.min(nodeText.length, matchIndex + searchText.length + 30);
        const context = origText.substring(contextStart, contextEnd).trim();

        this.searchResults.push({
          text: origText.substring(matchIndex, matchIndex + searchText.length),
          context: context,
          nodeIndex: index,
          matchIndex: matchIndex,
          matchNumber: matchCount,
          textContent: origText
        });

        matchCount++;
        startIndex = matchIndex + 1;
      }
    });

    console.log(`Found ${this.searchResults.length} results for "${this.searchText}"`);
  }

  /**
   * Navigate to a search result and highlight it
   */
  navigateToSearchResult(resultIndex: number): void {
    if (resultIndex < 0 || resultIndex >= this.searchResults.length) {
      console.warn('Invalid result index:', resultIndex);
      return;
    }

    // Update state immediately
    this.selectedResultIndex = resultIndex;
    const result = this.searchResults[resultIndex];
    
    console.log('Navigating to search result:', resultIndex, 'Match number:', result.matchNumber);

    // Defer DOM manipulation to next tick to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.ngZone.runOutsideAngular(() => {
        // Remove previous specific highlights (search-highlight class)
        // Convert NodeList to Array and reverse to avoid DOM modification issues
        const highlightsToRemove = Array.from(document.querySelectorAll('.search-highlight')).reverse();
        
        highlightsToRemove.forEach(el => {
          try {
            const parent = el.parentElement;
            if (parent !== null) {
              const textNode = document.createTextNode(el.textContent || '');
              parent.replaceChild(textNode, el);
              // Only call normalize if parent still exists
              if (parent.parentElement !== null) {
                parent.normalize();
              }
            }
          } catch (error) {
            console.warn('Error removing highlight element:', error);
          }
        });

        // Find the Nth match (counting from searchResults order)
        const editorContent = document.querySelector('.ProseMirror');
        if (!editorContent) {
          console.warn('Editor content (.ProseMirror) not found');
          return;
        }

        const searchText = this.searchFilters.matchCase ? this.searchText : this.searchText.toLowerCase();
        let matchCount = 0;
        let found = false;

        const walker = document.createTreeWalker(
          editorContent,
          NodeFilter.SHOW_TEXT,
          null
        );

        let currentNode: Node | null;

        while ((currentNode = walker.nextNode())) {
          const origText = currentNode.textContent || '';
          let nodeText = this.searchFilters.matchCase ? origText : origText.toLowerCase();
          
          let startIndex = 0;
          while (true) {
            const matchIndex = nodeText.indexOf(searchText, startIndex);
            if (matchIndex === -1) break;

            // Check whole word match if enabled
            if (this.searchFilters.wholeWord) {
              const charBefore = matchIndex > 0 ? nodeText[matchIndex - 1] : ' ';
              const charAfter = matchIndex + searchText.length < nodeText.length ? nodeText[matchIndex + searchText.length] : ' ';
              
              const isWordBoundaryBefore = !/\w/.test(charBefore);
              const isWordBoundaryAfter = !/\w/.test(charAfter);
              
              if (!isWordBoundaryBefore || !isWordBoundaryAfter) {
                startIndex = matchIndex + 1;
                continue;
              }
            }

            // Check if this is the match we're looking for
            if (matchCount === result.matchNumber) {
              console.log('Found target match at matchCount:', matchCount);
              
              // Found it! Highlight this match
              const beforeText = origText.substring(0, matchIndex);
              const matchedText = origText.substring(matchIndex, matchIndex + searchText.length);
              const afterText = origText.substring(matchIndex + searchText.length);

              // Create wrapper span
              const wrapper = document.createElement('span');
              
              if (beforeText) {
                wrapper.appendChild(document.createTextNode(beforeText));
              }

              const highlightSpan = document.createElement('span');
              highlightSpan.className = 'search-highlight';
              highlightSpan.setAttribute('data-search-highlight', result.matchNumber.toString());
              highlightSpan.setAttribute('data-match-number', result.matchNumber.toString());
              highlightSpan.appendChild(document.createTextNode(matchedText));
              wrapper.appendChild(highlightSpan);

              if (afterText) {
                wrapper.appendChild(document.createTextNode(afterText));
              }

              // Replace the text node
              if (currentNode.parentElement) {
                currentNode.parentElement.replaceChild(wrapper, currentNode);
                console.log('Highlight applied, scrolling into view');
              }

              // Scroll into view
              highlightSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
              found = true;
              break;
            }

            matchCount++;
            startIndex = matchIndex + 1;
          }

          if (found) break;
        }

        if (!found) {
          console.warn('Target match not found. Expected matchNumber:', result.matchNumber, 'Counted matches:', matchCount);
        }
      });
    }, 0);
  }

  /**
   * Clear search results and remove all highlights
   */
  clearSearch(): void {
    console.log('Clearing search...');

    // Clear timeout if any
    if (this.searchHighlightTimeout) {
      clearTimeout(this.searchHighlightTimeout);
    }

    // Clear all state
    this.searchText = '';
    this.searchResults = [];
    this.selectedResultIndex = -1;
    
    // Remove all highlights from editor
    this.removeAllHighlights();
    
    console.log('Search cleared successfully');
  }

  /**
   * Convert editor HTML to JATS and persist a local draft copy.
   */
  onSave(): void {
    if (!this.editorComponent) {
      alert('Editor is not ready yet.');
      return;
    }

    try {
      const jatsXml = this.editorComponent.getUpdatedJatsXml();
      localStorage.setItem('uniproof-jats-draft', jatsXml);
      this.lastSavedAt = new Date();
      this.saveStatusText = 'Saved';
      console.log('JATS draft saved successfully');
    } catch (error) {
      console.error('Error saving JATS draft:', error);
      this.saveStatusText = 'Save failed';
      alert('Unable to save JATS XML. Please check console logs.');
    }
  }

  /**
   * Convert editor HTML to JATS and export XML.
   */
  onSubmit(): void {
    if (!this.editorComponent) {
      alert('Editor is not ready yet.');
      return;
    }

    try {
      const jatsXml = this.editorComponent.getUpdatedJatsXml();
      this.downloadJatsXml(jatsXml);
      this.lastSavedAt = new Date();
      this.saveStatusText = 'Submitted';
      console.log('JATS XML generated and downloaded successfully');
    } catch (error) {
      console.error('Error generating JATS XML:', error);
      this.saveStatusText = 'Submit failed';
      alert('Unable to generate JATS XML. Please check console logs.');
    }
  }

  getLastSavedLabel(): string {
    if (!this.lastSavedAt) {
      return 'Not saved yet';
    }

    return `Last saved ${this.lastSavedAt.toLocaleTimeString()}`;
  }

  /**
   * Download JATS XML as a file
   */
  private downloadJatsXml(jatsXml: string): void {
    const element = document.createElement('a');
    const file = new Blob([jatsXml], { type: 'application/xml' });
    element.href = URL.createObjectURL(file);
    element.download = `article-${new Date().getTime()}.xml`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(element.href);
  }

  /**
   * Open HTML preview in a new tab
   */
  openPreview(): void {
    if (!this.editorComponent) {
      console.error('Editor component not found');
      alert('Error: Editor component not available');
      return;
    }

    try {
      // Get HTML content from editor
      const htmlContent = this.editorComponent.getUpdatedHtmlContent();

      if (!htmlContent || htmlContent.trim() === '') {
        alert('Document is empty. Please add content before previewing.');
        return;
      }

      // Create complete HTML document with Bootstrap styles
      const previewHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Document Preview</title>
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
              line-height: 1.6;
              color: #333;
              padding: 40px 20px;
              background-color: #f8f9fa;
            }
            .preview-container {
              max-width: 900px;
              margin: 0 auto;
              background-color: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            h1, h2, h3, h4, h5, h6 {
              margin-top: 24px;
              margin-bottom: 12px;
              font-weight: 600;
              color: #212529;
            }
            h1 {
              font-size: 28px;
              border-bottom: 2px solid #007bff;
              padding-bottom: 8px;
            }
            p {
              margin-bottom: 16px;
            }
            figure {
              margin: 24px 0;
              padding: 16px;
              background-color: #f0f0f0;
              border-radius: 4px;
              text-align: center;
            }
            figcaption {
              margin-top: 12px;
              font-style: italic;
              color: #666;
              font-size: 14px;
            }
            img {
              max-width: 100%;
              height: auto;
              border-radius: 4px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
              background-color: white;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            th, td {
              padding: 12px;
              border: 1px solid #ddd;
              text-align: left;
            }
            th {
              background-color: #007bff;
              color: white;
              font-weight: 600;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            tr:hover {
              background-color: #f0f0f0;
            }
            blockquote {
              border-left: 4px solid #007bff;
              padding-left: 16px;
              margin-left: 0;
              color: #666;
              font-style: italic;
            }
            code {
              background-color: #f4f4f4;
              padding: 2px 6px;
              border-radius: 3px;
              font-family: 'Courier New', monospace;
              color: #d63384;
            }
            pre {
              background-color: #f4f4f4;
              padding: 16px;
              border-radius: 4px;
              overflow-x: auto;
              margin: 16px 0;
            }
            pre code {
              color: #333;
              background-color: transparent;
              padding: 0;
            }
            a {
              color: #007bff;
              text-decoration: none;
            }
            a:hover {
              text-decoration: underline;
            }
            ul, ol {
              margin-bottom: 16px;
              padding-left: 24px;
            }
            li {
              margin-bottom: 8px;
            }
            hr {
              border: none;
              border-top: 2px solid #ddd;
              margin: 32px 0;
            }
            .search-highlight {
              background-color: #ffeb3b;
              padding: 2px 4px;
              border-radius: 2px;
              font-weight: bold;
            }
            .search-highlight-inline {
              background-color: #ffeb3b;
              padding: 2px 4px;
              border-radius: 2px;
              font-weight: bold;
            }
            .preview-footer {
              text-align: center;
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              color: #999;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="preview-container">
            ${htmlContent}
            <div class="preview-footer">
              <p>Generated on ${new Date().toLocaleString()}</p>
            </div>
          </div>
          <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
        </body>
        </html>
      `;

      // Open preview in new tab
      const previewWindow = window.open('', '_blank');
      if (previewWindow) {
        previewWindow.document.open();
        previewWindow.document.write(previewHtml);
        previewWindow.document.close();
        console.log('Preview opened successfully');
      } else {
        alert('Unable to open preview. Please allow popups for this site.');
      }
    } catch (error) {
      console.error('Error during preview:', error);
      alert('Error generating preview. Please check the console for details.');
    }
  }
}
