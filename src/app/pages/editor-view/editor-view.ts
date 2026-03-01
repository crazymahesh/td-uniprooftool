import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, ViewEncapsulation, ViewChild } from '@angular/core';
import { EditorComponent } from '../../components/editor-component/editor-component';
import { CommentService } from '../../services/comment.service';
import { FigureMetadata } from '../../components/editor-component/figure.model';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { htmlToJats } from '../../utils/html-to-jats';

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
  figures: FigureMetadata[] = [];
  
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
    private commentService: CommentService
  ) { }

  ngOnInit(): void {
    this.subscription.add(
      this.commentService.showCommentForm$.subscribe(() => {
        this.showNewCommentForm = true;
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
   * Convert editor content (HTML) to JATS XML and download
   */
  submitDocument(): void {
    if (!this.editorComponent) {
      console.error('Editor component not found');
      alert('Error: Editor component not available');
      return;
    }

    try {
      // Get updated HTML content from editor (includes all edits made in ProseMirror)
      const htmlContent = this.editorComponent.getUpdatedHtmlContent();
      console.log('HTML content to convert:', htmlContent);
      
      if (!htmlContent || htmlContent.trim() === '') {
        alert('Document is empty. Please add content before submitting.');
        return;
      }

      // Convert HTML to JATS XML with ID preservation
      const jatsXml = htmlToJats(htmlContent);

      console.log('Generated JATS XML with IDs:', jatsXml);
      console.log('Submitting document with updated content');

      // Extract and log IDs to verify preservation
      const idMatches = jatsXml.match(/id="([^"]+)"/g);
      if (idMatches && idMatches.length > 0) {
        console.log('✓ Preserved IDs:', idMatches.map(id => id.replace(/id="|"/g, '')));
      } else {
        console.log('ℹ No IDs found in generated XML');
      }

      // Download the JATS XML file
      this.downloadJatsXml(jatsXml);

      // Show success message
      const message = idMatches && idMatches.length > 0
        ? `Document converted and downloaded successfully!\n\n✓ Preserved ${idMatches.length} element IDs\n\nCheck your console to verify the generated JATS XML.`
        : 'Document converted and downloaded successfully!\n\nCheck your console to verify the generated JATS XML.';
      alert(message);
    } catch (error) {
      console.error('Error during document submission:', error);
      alert('Error converting document. Please check the console for details.');
    }
  }

  /**
   * Navigate to and highlight a figure in the editor
   */
  /**
   * Navigate to and highlight a figure in the editor
   */
  navigateToFigure(figureId: string): void {
    console.log('Navigating to figure:', figureId);
    
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

    // Debounce the highlighting to avoid too frequent updates
    this.searchHighlightTimeout = setTimeout(() => {
      // Clear previous highlights first
      this.removeAllHighlights();

      if (!this.searchText.trim()) {
        this.searchResults = [];
        this.selectedResultIndex = -1;
        return;
      }

      // Perform search and highlight
      this.performSearch();
      this.highlightAllMatches();
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
    
    // Get all text nodes
    const walker = document.createTreeWalker(
      editorContent,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentNode: Node | null;
    const nodesToReplace: Array<{node: Node, html: string}> = [];

    while ((currentNode = walker.nextNode())) {
      let nodeText = this.searchFilters.matchCase ? currentNode.textContent || '' : (currentNode.textContent || '').toLowerCase();
      let origText = currentNode.textContent || '';

      if (nodeText.includes(searchText)) {
        let highlightedText = origText;
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
    
          // Rebuild text with highlights
          const before = origText.substring(0, matchIndex);
          const matched = origText.substring(matchIndex, matchIndex + searchText.length);
          const after = origText.substring(matchIndex + searchText.length);
    
          highlightedText = before + `<span class="search-highlight-inline">${matched}</span>` + after;
          origText = after;
          nodeText = this.searchFilters.matchCase ? after : after.toLowerCase();
          startIndex = 0;
        }

        if (highlightedText !== origText) {
          nodesToReplace.push({ node: currentNode, html: highlightedText });
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
   * Remove all inline search highlights
   */
  private removeAllHighlights(): void {
    const highlights = document.querySelectorAll('.search-highlight-inline, .search-highlight');
    highlights.forEach(el => {
      const parent = el.parentElement;
      if (parent) {
        const textNode = document.createTextNode(el.textContent || '');
        parent.replaceChild(textNode, el);
        parent.normalize();
      }
    });
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
    
    // Get all text nodes from the editor
    const walker = document.createTreeWalker(
      editorContent,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentNode: Node | null;
    let nodeIndex = 0;
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
          node: node,
          parentElement: (node as any).parentElement
        });

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
      return;
    }

    const result = this.searchResults[resultIndex];
    this.selectedResultIndex = resultIndex;

    if (result.parentElement) {
      // Scroll parent element into view
      result.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Remove previous highlights
      document.querySelectorAll('.search-highlight').forEach(el => {
        const parent = el.parentElement;
        if (parent) {
          parent.replaceChild(document.createTextNode(el.textContent || ''), el);
          parent.normalize();
        }
      });

      // Highlight the matched text
      if (result.node && result.node.parentElement) {
        this.highlightTextNode(result.node, result.text);
      }
    }
  }

  /**
   * Highlight text within a node
   */
  private highlightTextNode(node: Node, searchText: string): void {
    const text = node.textContent || '';
    const matchIndex = text.indexOf(searchText);

    if (matchIndex === -1) return;

    const span = document.createElement('span');
    span.className = 'search-highlight';
    
    const before = document.createTextNode(text.substring(0, matchIndex));
    const matched = document.createTextNode(text.substring(matchIndex, matchIndex + searchText.length));
    const after = document.createTextNode(text.substring(matchIndex + searchText.length));

    span.appendChild(matched);

    const parent = node.parentElement;
    if (parent) {
      parent.replaceChild(after, node);
      parent.insertBefore(span, after);
      parent.insertBefore(before, span);
    }
  }

  /**
   * Clear search results
   */
  /**
   * Clear search results
   */
  clearSearch(): void {
    // Clear timeout if any
    if (this.searchHighlightTimeout) {
      clearTimeout(this.searchHighlightTimeout);
    }

    this.searchText = '';
    this.searchResults = [];
    this.selectedResultIndex = -1;
    
    // Remove all highlights
    this.removeAllHighlights();
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
}
