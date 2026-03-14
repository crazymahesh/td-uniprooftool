import { Injectable } from '@angular/core';
import { APP_CONSTANTS } from '../app.constants';

/**
 * Service to convert JATS XML to HTML
 * JATS (Journalistic Article Interchange Tags) is a standard for scientific and academic articles
 */
@Injectable({
  providedIn: 'root'
})
export class JatsConverterService {

  /**
   * Convert JATS XML string to HTML
   * @param jatsXml The JATS XML content as a string
   * @returns HTML string that can be rendered in the editor
   */
  convertJatsToHtml(jatsXml: string): string {
    try {
      const parser = new DOMParser();
      
      const xmlDoc = parser.parseFromString(jatsXml, 'application/xml');

      // Check for parsing errors
      const parseErrors = xmlDoc.getElementsByTagName('parsererror');
      if (parseErrors.length > 0) {
        console.error('Parser error found:', parseErrors[0].textContent);
        return '<p>Error parsing XML document: ' + parseErrors[0].textContent + '</p>';
      }

      // Get article root element - works with namespaced XML
      const articleElement = this.findElementByTagName(xmlDoc, 'article');

      if (articleElement) {
        let html = '';
        
        // Process front matter (metadata)
        const frontElement = this.findElementByTagName(articleElement, 'front');
        if (frontElement) {
          html += this.convertFront(frontElement);
        }
        
        // Process body content
        const bodyElement = this.findElementByTagName(articleElement, 'body');
        if (bodyElement) {
          html += this.convertElement(bodyElement);
        }
        
        return html;
      }

      console.error('No article element found in XML');
      return '<p>No article content found</p>';
    } catch (error) {
      console.error('Error converting JATS to HTML:', error);
      return '<p>Error converting document: ' + (error as Error).message + '</p>';
    }
  }

  /**
   * Find an element by tag name, ignoring namespaces
   */
  private findElementByTagName(parent: Element | Document, tagName: string): Element | null {
    // Get all child elements
    const children = parent.childNodes;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        // Compare local name without namespace
        const localName = el.localName || el.tagName.split(':').pop();
        if (localName === tagName) {
          return el;
        }
        // Recursively search
        const found = this.findElementByTagName(el, tagName);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Find all elements by tag name, ignoring namespaces
   */
  private findElementsByTagName(parent: Element, tagName: string): Element[] {
    const results: Element[] = [];
    const children = parent.childNodes;
    
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        const localName = el.localName || el.tagName.split(':').pop();
        if (localName === tagName) {
          results.push(el);
        }
        // Recursively search
        results.push(...this.findElementsByTagName(el, tagName));
      }
    }
    return results;
  }

  /**
   * Convert front matter (article metadata)
   */
  private convertFront(frontElement: Element): string {
    let html = '';

    try {
      // Extract article title
      const titleElement = this.findElementByTagName(frontElement, 'article-title');
      if (titleElement?.textContent) {
        const title = titleElement.textContent.trim();
        if (title) {
          html += `<h1 class="mb-4">${this.escapeHtml(title)}</h1>`;
        }
      }

      // Extract alt-title (deck/subtitle)
      const altTitle = this.findElementByTagName(frontElement, 'alt-title');
      if (altTitle?.textContent) {
        const altText = altTitle.textContent.trim();
        if (altText) {
          html += `<p class="lead text-muted mb-4">${this.escapeHtml(altText)}</p>`;
        }
      }

      // Extract authors
      const contribElements = this.findElementsByTagName(frontElement, 'contrib')
        .filter(el => el.getAttribute('contrib-type') === 'author');
      
      if (contribElements.length > 0) {
        const authors: string[] = [];
        contribElements.forEach(contrib => {
          const author = this.extractAuthor(contrib);
          if (author) authors.push(author);
        });

        if (authors.length > 0) {
          html += `<div class="mb-4"><p class="mb-2"><strong>Authors:</strong> ${authors.join(', ')}</p>`;
          
          // Add author bios
          contribElements.forEach((contrib) => {
            const bioEl = this.findElementByTagName(contrib, 'bio');
            if (bioEl) {
              const pEl = this.findElementByTagName(bioEl, 'p');
              if (pEl?.textContent) {
                html += `<p class="small text-muted mb-2">${this.convertElement(pEl)}</p>`;
              }
            }
          });
          
          html += '</div>';
        }
      }

      // Extract publication date
      const pubDates = this.findElementsByTagName(frontElement, 'pub-date')
        .filter(el => el.getAttribute('date-type') === 'pub');
      
      const pubDate = pubDates.length > 0 ? pubDates[0] : null;
      if (pubDate) {
        const day = this.findElementByTagName(pubDate, 'day')?.textContent?.trim() || '';
        const month = this.findElementByTagName(pubDate, 'month')?.textContent?.trim() || '';
        const year = this.findElementByTagName(pubDate, 'year')?.textContent?.trim() || '';
        
        if (year || month || day) {
          const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const monthName = month ? monthNames[parseInt(month)] || month : '';
          const dateStr = [monthName, day].filter(x => x).join(' ') + (year ? ', ' + year : '');
          
          if (dateStr) {
            html += `<p class="text-muted mb-4"><small>Published: ${dateStr}</small></p>`;
          }
        }
      }

      // Extract volume/issue
      const volume = this.findElementByTagName(frontElement, 'volume')?.textContent?.trim();
      const issue = this.findElementByTagName(frontElement, 'issue')?.textContent?.trim();
      if (volume || issue) {
        let volIssueText = '';
        if (volume) volIssueText += `Volume ${volume}`;
        if (issue) volIssueText += (volIssueText ? ', ' : '') + `Issue ${issue}`;
        if (volIssueText) {
          html += `<p class="text-muted mb-4"><small>${volIssueText}</small></p>`;
        }
      }

      // Extract abstract
      const abstractElement = this.findElementByTagName(frontElement, 'abstract');
      if (abstractElement) {
        const abstractTitleEl = this.findElementByTagName(abstractElement, 'title');
        const abstractTitle = abstractTitleEl?.textContent || 'Abstract';
        const abstractContent = this.convertElement(abstractElement);
        if (abstractContent) {
          html += `<div class="alert alert-info mb-4"><h5>${abstractTitle}</h5>${abstractContent}</div>`;
        }
      }

      // Add separator
      if (html) {
        html += '<hr class="my-5">';
      }
    } catch (error) {
      console.error('Error converting front matter:', error);
    }

    return html;
  }

  /**
   * Escape HTML special characters to prevent XSS
   */
  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, char => map[char]);
  }

  /**
   * Extract author name from contrib element
   */
  private extractAuthor(contrib: Element): string {
    try {
      const nameEl = this.findElementByTagName(contrib, 'name');
      if (!nameEl) return '';
      
      const surname = this.findElementByTagName(nameEl, 'surname')?.textContent?.trim() || '';
      const givenNames = this.findElementByTagName(nameEl, 'given-names')?.textContent?.trim() || '';
      
      if (!surname && !givenNames) return '';
      return [givenNames, surname].filter(x => x).join(' ');
    } catch (error) {
      return '';
    }
  }

  /**
   * Recursively convert XML elements to HTML
   */
  private convertElement(element: Element | Document): string {
    let html = '';

    Array.from(element.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node as Text).textContent?.trim();
        if (text) {
          html += text;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const tagName = el.tagName.toLowerCase();

        switch (tagName) {
          // Container elements
          case 'article':
          case 'front':
          case 'body':
            html += this.convertElement(el);
            break;

          // Main content elements
          case 'p':
            html += this.convertParagraph(el);
            break;

          case 'sec':
            html += this.convertSection(el);
            break;

          case 'title':
            // Title is handled by parent context
            break;

          // Text formatting
          case 'bold':
          case 'b':
            html += `<strong>${this.convertElement(el)}</strong>`;
            break;

          case 'italic':
          case 'i':
            html += `<em>${this.convertElement(el)}</em>`;
            break;

          case 'underline':
          case 'u':
            html += `<u>${this.convertElement(el)}</u>`;
            break;

          case 'monospace':
          case 'code':
          case 'styled-content':
            if (el.getAttribute('style-type') === 'monospace') {
              html += `<code>${this.convertElement(el)}</code>`;
            } else {
              html += this.convertElement(el);
            }
            break;

          // Lists
          case 'list':
            html += this.convertList(el);
            break;

          case 'list-item':
          case 'li':
            html += `<li>${this.convertElement(el)}</li>`;
            break;

          // Tables
          case 'table-wrap':
            html += this.convertTableWrap(el);
            break;

          case 'table':
            html += this.convertTable(el);
            break;

          case 'thead':
          case 'tbody':
          case 'tr':
          case 'th':
          case 'td':
            html += this.convertTableElement(el);
            break;

          // Figures and media
          case 'fig':
            html += this.convertFigure(el);
            break;

          case 'disp-quote':
            html += this.convertDisplayQuote(el);
            break;

          case 'graphic':
            html += this.convertGraphic(el);
            break;

          case 'caption':
            // Caption is handled by parent context
            break;

          // References and citations
          case 'ref-list':
            html += this.convertRefList(el);
            break;

          case 'ref':
            html += this.convertReference(el);
            break;

          case 'element-citation':
          case 'mixed-citation':
            html += this.convertCitation(el);
            break;

          // Metadata elements that should be skipped in body
          case 'article-meta':
          case 'journal-meta':
          case 'contrib-group':
          case 'bio':
          case 'pub-date':
          case 'permissions':
          case 'counts':
          case 'article-id':
          case 'article-categories':
          case 'self-uri':
            // Skip metadata elements
            break;

          // Skip title-group in body (handled in front)
          case 'title-group':
            break;

          // Price and other leaf nodes
          case 'price':
          case 'fpage':
          case 'lpage':
          case 'volume':
          case 'issue':
          case 'day':
          case 'month':
          case 'year':
            // Skip processed metadata
            break;

          default:
            // For unknown tags, just convert the content
            html += this.convertElement(el);
        }
      }
    });

    return html;
  }

  private convertSection(element: Element): string {
    const id = element.getAttribute('id') || '';
    const titleEl = this.findElementByTagName(element, 'title');
    const depth = this.getSectionDepth(element);
    const headingLevel = Math.min(depth + 2, 6); // h2 to h6

    let html = `<section${id ? ` id="${id}"` : ''} class="mb-5">`;
    
    if (titleEl) {
      const title = titleEl.textContent || '';
      html += `<h${headingLevel} class="fw-bold mb-3 mt-4">${title}</h${headingLevel}>`;
    }

    // Convert child elements (skip the title)
    Array.from(element.childNodes).forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const localName = el.localName || el.tagName.split(':').pop();
        if (localName !== 'title') {
          html += this.convertElement(el);
        }
      }
    });

    html += '</section>';
    return html;
  }

  private getSectionDepth(section: Element): number {
    let depth = 0;
    let parent = section.parentElement;
    while (parent && parent.tagName.toLowerCase() === 'sec') {
      depth++;
      parent = parent.parentElement;
    }
    return depth;
  }

  private convertParagraph(element: Element): string {
    const content = this.convertElement(element);
    return `<p class="mb-3">${content}</p>`;
  }

  private convertList(element: Element): string {
    const listType = element.getAttribute('list-type') || 'bullet';
    const tag = listType === 'order' || listType === 'ordered' ? 'ol' : 'ul';
    let html = `<${tag} class="mb-4">`;
    html += this.convertElement(element);
    html += `</${tag}>`;
    return html;
  }

  private convertTableWrap(element: Element): string {
    let html = '<div class="table-responsive mb-4">';
    html += this.convertElement(element);
    html += '</div>';
    return html;
  }

  private convertTable(element: Element): string {
    let html = '<table class="table table-bordered table-hover">';
    html += this.convertElement(element);
    html += '</table>';
    return html;
  }

  private convertTableElement(element: Element): string {
    const tagName = element.tagName.toLowerCase();
    let html = `<${tagName}`;

    if (tagName === 'thead') {
      html += ' class="table-light"';
    }

    html += '>';
    html += this.convertElement(element);
    html += `</${tagName}>`;
    return html;
  }

  private convertFigure(element: Element): string {
    const id = element.getAttribute('id') || '';
    const caption = this.findElementByTagName(element, 'caption');
    const graphic = this.findElementByTagName(element, 'graphic');

    let html = `<figure class="figure border p-3 bg-light mb-4"${id ? ` id="${id}"` : ''}>`;
    
    if (graphic) {
      html += this.convertGraphic(graphic);
    }
    
    if (caption) {
      const captionText = Array.from(caption.childNodes)
        .map(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            return this.convertElement(node as Element);
          } else if (node.nodeType === Node.TEXT_NODE) {
            return (node as Text).textContent?.trim() || '';
          }
          return '';
        })
        .join('');
      html += `<figcaption class="figcaption mt-3">${captionText}</figcaption>`;
    }
    
    html += '</figure>';
    return html;
  }

  private convertDisplayQuote(element: Element): string {
    let html = '<div class="blockquote-wrapper my-4">';
    html += this.convertElement(element);
    html += '</div>';
    return html;
  }

  private convertGraphic(element: Element): string {
    const rawHref = element.getAttribute('xlink:href') || 
                 element.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ||
                 element.getAttribute('href') || '';
    const normalized = rawHref && !rawHref.startsWith('/') ? `/img/xml-img/${rawHref}` : rawHref;
    const href = normalized ? `${APP_CONSTANTS.FIGURE_BASE_URL}${normalized}` : '';
    const alt = element.getAttribute('alt') || 'Figure';
    
    return `<img src="${href}" class="figure-img img-fluid rounded" alt="${alt}" style="max-width: 100%; max-height: 400px;">`;
  }

  private convertRefList(element: Element): string {
    let html = '<h2 class="h3 fw-bold mb-4 border-bottom pb-2">References</h2>';
    html += '<ol class="mb-5 small text-muted">';
    html += this.convertElement(element);
    html += '</ol>';
    return html;
  }

  private convertReference(element: Element): string {
    const id = element.getAttribute('id') || '';
    let html = `<li class="mb-2"${id ? ` id="${id}"` : ''}>`;
    const citation = this.findElementByTagName(element, 'element-citation') || 
                     this.findElementByTagName(element, 'mixed-citation') || 
                     element;
    html += this.convertCitation(citation);
    html += '</li>';
    return html;
  }

  private convertCitation(element: Element): string {
    // Get person group and extract names
    const personGroups = this.findElementsByTagName(element, 'person-group')
      .filter(pg => pg.getAttribute('person-group-type') === 'author');
    
    const authors: string[] = [];
    personGroups.forEach(pg => {
      this.findElementsByTagName(pg, 'name').forEach(name => {
        const authorName = this.getAuthorName(name);
        if (authorName) authors.push(authorName);
      });
    });

    const year = this.findElementByTagName(element, 'year')?.textContent || '';
    const title = this.findElementByTagName(element, 'article-title')?.textContent || '';
    const source = this.findElementByTagName(element, 'source')?.textContent || '';
    const volume = this.findElementByTagName(element, 'volume')?.textContent || '';
    const fpage = this.findElementByTagName(element, 'fpage')?.textContent || '';
    const lpage = this.findElementByTagName(element, 'lpage')?.textContent || '';

    let citation = '';
    if (authors.length > 0) citation += authors.join(', ');
    if (year) citation += ` (${year}).`;
    if (title) citation += ` ${title}.`;
    if (source) citation += ` <em>${source}</em>`;
    if (volume) citation += `, ${volume}`;
    if (fpage && lpage) citation += `, ${fpage}-${lpage}`;
    else if (fpage) citation += `, ${fpage}`;

    return citation || this.convertElement(element);
  }

  private getAuthorName(nameElement: Element): string {
    const surname = this.findElementByTagName(nameElement, 'surname')?.textContent?.trim() || '';
    const givenNames = this.findElementByTagName(nameElement, 'given-names')?.textContent?.trim() || '';
    if (!surname && !givenNames) return '';
    return [surname, givenNames].filter(x => x).join(', ');
  }
}
