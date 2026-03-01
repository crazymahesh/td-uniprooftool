/**
 * Convert HTML content back to JATS XML format
 * This is a reverse transformation of jatsToHtml
 */

export function htmlToJats(htmlContent: string): string {
  if (!htmlContent || htmlContent.trim() === '') {
    return '<?xml version="1.0" encoding="UTF-8"?><article></article>';
  }

  try {
    // Parse the HTML content
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<root>${htmlContent}</root>`, 'text/html');
    
    if (parser.parseFromString('', 'text/html').getElementsByTagName('parsererror').length > 0) {
      console.error('HTML parsing error');
      return '<?xml version="1.0" encoding="UTF-8"?><article></article>';
    }

    const root = doc.body.firstElementChild as HTMLElement;
    
    // Build JATS structure
    let jatsXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    jatsXml += '<article xmlns:xlink="http://www.w3.org/1999/xlink">\n';
    jatsXml += '  <front>\n';
    jatsXml += extractFrontMatter(root);
    jatsXml += '  </front>\n';
    jatsXml += '  <body>\n';
    jatsXml += extractBodyContent(root);
    jatsXml += '  </body>\n';
    jatsXml += '</article>';

    return jatsXml;
  } catch (error) {
    console.error('Error converting HTML to JATS:', error);
    return '<?xml version="1.0" encoding="UTF-8"?><article></article>';
  }
}

/**
 * Extract front matter (metadata, title, abstract, etc.)
 */
function extractFrontMatter(root: Element): string {
  let front = '';

  // Extract article title (h1 or article-title)
  const titleElement = root.querySelector('h1');
  if (titleElement) {
    front += `    <article-meta>\n`;
    front += `      <title-group>\n`;
    front += `        <article-title>${escapeXml(titleElement.textContent || '')}</article-title>\n`;
    front += `      </title-group>\n`;
    front += `    </article-meta>\n`;
  }

  // Extract authors from paragraphs with author class
  const authors = root.querySelectorAll('p.author, .author');
  if (authors.length > 0) {
    front += `    <contrib-group>\n`;
    authors.forEach((author) => {
      front += `      <contrib contrib-type="author">\n`;
      front += `        <name>\n`;
      front += `          <surname>${escapeXml(author.textContent || '')}</surname>\n`;
      front += `        </name>\n`;
      front += `      </contrib>\n`;
    });
    front += `    </contrib-group>\n`;
  }

  // Extract abstract
  const abstractElement = root.querySelector('p.lead, .abstract, p[class*="abstract"]');
  if (abstractElement) {
    front += `    <abstract>\n`;
    front += `      <p>${escapeXml(abstractElement.textContent || '')}</p>\n`;
    front += `    </abstract>\n`;
  }

  return front;
}

/**
 * Extract body content recursively
 */
function extractBodyContent(root: Element): string {
  let body = '';
  let firstParagraphProcessed = false;

  // Process all child elements
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      
      // Skip title, author, abstract elements as they belong to front
      if (['H1', 'H2'].includes(element.tagName) && !firstParagraphProcessed) {
        firstParagraphProcessed = true;
        return;
      }
      if (element.classList.contains('lead') || element.classList.contains('author')) {
        return;
      }

      const content = elementToJats(element);
      if (content.trim()) {
        body += content;
      }
    }
  });

  return body;
}

/**
 * Convert individual HTML element to JATS XML
 * Preserves ID attributes from HTML elements
 */
function elementToJats(element: HTMLElement, depth = 1): string {
  const indent = '    '.repeat(depth);
  let result = '';
  const elementId = element.getAttribute('id') ? ` id="${escapeXml(element.getAttribute('id') || '')}"` : '';

  switch (element.tagName.toLowerCase()) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      result += `${indent}<sec${elementId}>\n`;
      result += `${indent}  <title>${escapeXml(element.textContent || '')}</title>\n`;
      result += `${indent}</sec>\n`;
      break;

    case 'p':
      result += `${indent}<p>${escapeXml(element.textContent || '')}</p>\n`;
      break;

    case 'figure':
      const figId = element.getAttribute('id') ? ` id="${escapeXml(element.getAttribute('id') || '')}"` : '';
      result += `${indent}<fig${figId}>\n`;
      // Extract label and caption
      const label = element.querySelector('label, .label');
      if (label) {
        result += `${indent}  <label>${escapeXml(label.textContent || '')}</label>\n`;
      }

      // Extract image
      const img = element.querySelector('img');
      if (img) {
        const src = img.getAttribute('src') || '';
        // Remove /img/xml-img/ prefix if present
        const cleanSrc = src.replace(/^\/img\/xml-img\//, '');
        result += `${indent}  <graphic xlink:href="${escapeXml(cleanSrc)}" />\n`;
      }

      // Extract caption (figcaption or disp-quote)
      const caption = element.querySelector('figcaption, .figure-caption, disp-quote, .disp-quote');
      if (caption) {
        result += `${indent}  <caption>\n`;
        result += `${indent}    <p>${escapeXml(caption.textContent || '')}</p>\n`;
        result += `${indent}  </caption>\n`;
      }

      result += `${indent}</fig>\n`;
      break;

    case 'ul':
    case 'ol':
      const listType = element.tagName.toLowerCase() === 'ul' ? 'bullet' : 'order';
      result += `${indent}<list list-type="${listType}">\n`;
      element.querySelectorAll(':scope > li').forEach((li) => {
        result += `${indent}  <list-item>\n`;
        result += `${indent}    <p>${escapeXml(li.textContent || '')}</p>\n`;
        result += `${indent}  </list-item>\n`;
      });
      result += `${indent}</list>\n`;
      break;

    case 'table':
      result += `${indent}<table-wrap>\n`;
      result += `${indent}  <table>\n`;
      element.querySelectorAll('tr').forEach((tr) => {
        result += `${indent}    <tr>\n`;
        tr.querySelectorAll('td, th').forEach((td) => {
          const tagName = td.tagName.toLowerCase() === 'th' ? 'th' : 'td';
          result += `${indent}      <${tagName}>${escapeXml(td.textContent || '')}</${tagName}>\n`;
        });
        result += `${indent}    </tr>\n`;
      });
      result += `${indent}  </table>\n`;
      result += `${indent}</table-wrap>\n`;
      break;

    case 'blockquote':
      result += `${indent}<disp-quote>\n`;
      result += `${indent}  <p>${escapeXml(element.textContent || '')}</p>\n`;
      result += `${indent}</disp-quote>\n`;
      break;

    case 'section':
    case 'div':
      if (element.classList.contains('section') || element.tagName === 'SECTION') {
        const sectionId = element.getAttribute('id') ? ` id="${escapeXml(element.getAttribute('id') || '')}"` : '';
        result += `${indent}<sec${sectionId}>\n`;
        element.childNodes.forEach((child) => {
          if (child.nodeType === Node.ELEMENT_NODE) {
            result += elementToJats(child as HTMLElement, depth + 1);
          }
        });
        result += `${indent}</sec>\n`;
      } else {
        // Generic div - process children
        element.childNodes.forEach((child) => {
          if (child.nodeType === Node.ELEMENT_NODE) {
            result += elementToJats(child as HTMLElement, depth);
          }
        });
      }
      break;

    case 'strong':
    case 'b':
      result += `<bold>${escapeXml(element.textContent || '')}</bold>`;
      break;

    case 'em':
    case 'i':
      result += `<italic>${escapeXml(element.textContent || '')}</italic>`;
      break;

    case 'u':
      result += `<underline>${escapeXml(element.textContent || '')}</underline>`;
      break;

    case 'sub':
      result += `<sub>${escapeXml(element.textContent || '')}</sub>`;
      break;

    case 'sup':
      result += `<sup>${escapeXml(element.textContent || '')}</sup>`;
      break;

    case 'a':
      const href = element.getAttribute('href') || '';
      result += `<ext-link xlink:href="${escapeXml(href)}">${escapeXml(element.textContent || '')}</ext-link>`;
      break;

    default:
      // For unknown elements, process children
      element.childNodes.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          result += elementToJats(child as HTMLElement, depth);
        } else if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent || '';
          if (text.trim()) {
            result += escapeXml(text);
          }
        }
      });
  }

  return result;
}

/**
 * Escape special XML characters
 */
function escapeXml(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
