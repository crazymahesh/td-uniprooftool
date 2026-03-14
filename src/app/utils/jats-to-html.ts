// utils/jats-to-html.ts
import { APP_CONSTANTS } from '../app.constants';

function resolveImagePath(href: string): string {
  const normalized = href && !href.startsWith('/') ? `/img/xml-img/${href}` : href;
  return normalized ? `${APP_CONSTANTS.FIGURE_BASE_URL}${normalized}` : '';
}

/**
 * Master JATS to HTML converter that preserves all XML attributes and tags
 * @param xml The JATS XML string to convert
 * @returns HTML string with all attributes preserved
 */
export function jatsToHtmlMaster(xml: string): string {
  try {
    // Step 1: Replace valid HTML entities with placeholders to protect them
    const entityMap: { [key: string]: string } = {};
    let placeholderIndex = 0;

    // List of valid HTML entities
    const knownEntities = [
      'mdash', 'ndash', 'copy', 'reg', 'trade', 'nbsp', 'cent', 'pound', 'yen', 'euro',
      'deg', 'hellip', 'ldquo', 'rdquo', 'lsquo', 'rsquo', 'bull', 'rarr', 'larr',
      'uarr', 'darr', 'amp', 'lt', 'gt', 'quot', 'apos'
    ];

    let protectedXml = xml;
    knownEntities.forEach(entity => {
      const entityRegex = new RegExp(`&${entity};`, 'g');
      let match;
      while ((match = entityRegex.exec(protectedXml)) !== null) {
        const placeholder = `__ENTITY_PLACEHOLDER_${placeholderIndex}__`;
        entityMap[placeholder] = `&${entity};`;
        protectedXml = protectedXml.substring(0, match.index) + placeholder + protectedXml.substring(match.index + match[0].length);
        entityRegex.lastIndex = match.index + placeholder.length;
        placeholderIndex++;
      }
    });

    protectedXml = protectedXml.replace(/&/g, '&amp;');
    Object.entries(entityMap).forEach(([placeholder, entity]) => {
      protectedXml = protectedXml.replaceAll(placeholder, entity);
    });

    // Step 2: Convert HTML entities to numeric character references
    const htmlEntityMap: { [key: string]: string } = {
      '&mdash;': '&#8212;',
      '&ndash;': '&#8211;',
      '&copy;': '&#169;',
      '&reg;': '&#174;',
      '&trade;': '&#8482;',
      '&nbsp;': '&#160;',
      '&cent;': '&#162;',
      '&pound;': '&#163;',
      '&yen;': '&#165;',
      '&euro;': '&#8364;',
      '&deg;': '&#176;',
      '&hellip;': '&#8230;',
      '&ldquo;': '&#8220;',
      '&rdquo;': '&#8221;',
      '&lsquo;': '&#8216;',
      '&rsquo;': '&#8217;',
      '&bull;': '&#8226;',
      '&rarr;': '&#8594;',
      '&larr;': '&#8592;',
      '&uarr;': '&#8593;',
      '&darr;': '&#8595;',
    };

    let cleanedXml = protectedXml;
    Object.entries(htmlEntityMap).forEach(([entity, numeric]) => {
      cleanedXml = cleanedXml.replaceAll(entity, numeric);
    });

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(cleanedXml, 'application/xml');

    const parseError = xmlDoc.getElementsByTagName('parsererror');
    if (parseError.length > 0) {
      const errorMsg = parseError[0].textContent || 'Unknown parsing error';
      console.error('XML Parsing error:', errorMsg);
      return '<p>Error parsing XML: ' + errorMsg + '</p>';
    }

    return processMasterDocument(xmlDoc);
  } catch (err) {
    console.error('Fatal error in JATS conversion:', err);
    return '<p>Error converting JATS XML to HTML: ' + (err as Error).message + '</p>';
  }

  function processMasterDocument(xmlDoc: XMLDocument): string {
    // Mapping of JATS tags to semantic HTML
    const semanticMap: { [key: string]: string } = {
      'bold': 'strong',
      'italic': 'em',
      'underline': 'u',
      'sub': 'sub',
      'sup': 'sup',
      'p': 'p',
      'disp-quote': 'blockquote',
      'ext-link': 'a',
      'uri': 'a',
      'xref': 'a',
      'list': 'ul',
      'list-item': 'li',
      'sec': 'section',
      'fig': 'figure',
      'caption': 'figcaption',
      'title': 'h2',
      'label': 'strong'
    };

    function serializeAttributes(el: Element): string {
      const attrs: string[] = [];
      
      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        // Convert namespace attributes to data attributes
        if (attr.name.includes(':')) {
          const attrName = attr.name.replace(':', '-');
          attrs.push(`data-${attrName}="${escapeHtml(attr.value)}"`);
        } else {
          attrs.push(`${attr.name}="${escapeHtml(attr.value)}"`);
        }
      }
      return attrs.length > 0 ? ' ' + attrs.join(' ') : '';
    }

    function escapeHtml(text: string): string {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function nodeToHtml(node: Node): string {
      try {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          return text;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const el = node as Element;
        const tagName = el.tagName.toLowerCase();
        const attributes = serializeAttributes(el);

        // Get children HTML
        const childrenHtml = Array.from(el.childNodes)
          .map((child) => nodeToHtml(child))
          .join('');

        // Determine output tag
        const outputTag = semanticMap[tagName] || tagName;

        // Handle special cases
        if (tagName === 'fig') {
          const imgPath = el.querySelector('graphic')?.getAttribute('xlink:href') || 
                          el.querySelector('graphic')?.getAttribute('href') || '';
          const resolvedPath = resolveImagePath(imgPath);
          
          // Get children HTML excluding graphic elements (already handled above)
          const nonGraphicChildren = Array.from(el.childNodes)
            .filter(child => {
              if (child.nodeType === Node.ELEMENT_NODE) {
                return (child as Element).tagName.toLowerCase() !== 'graphic';
              }
              return true;
            })
            .map((child) => nodeToHtml(child))
            .join('');
          
          return `<figure${attributes}>${resolvedPath ? `<img src="${resolvedPath}" alt="">` : ''}${nonGraphicChildren}</figure>`;
        }

        if (tagName === 'graphic') {
          const href = el.getAttribute('xlink:href') || el.getAttribute('href') || '';
          return `<img src="${href}"${attributes} alt="">`;
        }

        if (tagName === 'ext-link' || tagName === 'uri') {
          const href = el.getAttribute('xlink:href') || el.getAttribute('href') || '#';
          return `<a href="${href}"${attributes}>${childrenHtml}</a>`;
        }

        if (tagName === 'xref') {
          const rid = el.getAttribute('rid');
          return `<a href="#${rid}"${attributes}>${childrenHtml}</a>`;
        }

        if (tagName === 'list') {
          const listType = el.getAttribute('list-type') === 'ordered' ? 'ol' : 'ul';
          return `<${listType}${attributes}>${childrenHtml}</${listType}>`;
        }

        if (tagName === 'title' && el.parentElement?.tagName.toLowerCase() === 'sec') {
          return ''; // Skip title in section, will be handled separately
        }

        // Default: wrap in semantic tag with all attributes
        return `<${outputTag}${attributes}>${childrenHtml}</${outputTag}>`;
      } catch (err) {
        console.error('Error processing node:', node, err);
        return '';
      }
    }

    let htmlOutput = '';

    // Process front section
    const frontNode = xmlDoc.getElementsByTagName('front')[0];
    if (frontNode) {
      const articleMeta = frontNode.getElementsByTagName('article-meta')[0];
      if (articleMeta) {
        // Article Title
        const titleGroup = articleMeta.getElementsByTagName('title-group')[0];
        if (titleGroup) {
          const articleTitle = titleGroup.getElementsByTagName('article-title')[0]?.textContent ?? '';
          if (articleTitle) {
            htmlOutput += `<h1>${articleTitle}</h1>`;
          }

          const altTitle = titleGroup.getElementsByTagName('alt-title')[0];
          if (altTitle) {
            const altAttrs = serializeAttributes(altTitle);
            htmlOutput += `<p${altAttrs}>${altTitle.textContent ?? ''}</p>`;
          }
        }

        // Authors with bio
        const contribGroup = articleMeta.getElementsByTagName('contrib-group')[0];
        if (contribGroup) {
          const contribs = Array.from(contribGroup.getElementsByTagName('contrib'));
          contribs.forEach((contrib) => {
            const contribAttrs = serializeAttributes(contrib);
            const name = contrib.getElementsByTagName('name')[0];
            const bio = contrib.getElementsByTagName('bio')[0];
            
            htmlOutput += `<div class="contributor"${contribAttrs}>`;
            if (name) {
              const surname = name.getElementsByTagName('surname')[0]?.textContent ?? '';
              const givenNames = name.getElementsByTagName('given-names')[0]?.textContent ?? '';
              const nameAttrs = serializeAttributes(name);
              htmlOutput += `<span${nameAttrs}>${givenNames} ${surname}</span>`;
            }
            if (bio) {
              const bioContent = Array.from(bio.childNodes)
                .map((child) => nodeToHtml(child))
                .join('');
              htmlOutput += `<div>${bioContent}</div>`;
            }
            htmlOutput += `</div>`;
          });
        }

        // Abstract
        const abstract = articleMeta.getElementsByTagName('abstract')[0];
        if (abstract) {
          const abstractAttrs = serializeAttributes(abstract);
          htmlOutput += `<section class="abstract"${abstractAttrs}>`;
          const abstractContent = Array.from(abstract.childNodes)
            .map((child) => nodeToHtml(child))
            .join('');
          htmlOutput += abstractContent;
          htmlOutput += `</section>`;
        }
      }
    }

    // Process body section
    const bodyNode = xmlDoc.getElementsByTagName('body')[0];
    if (bodyNode) {
      const bodyAttrs = serializeAttributes(bodyNode);
      htmlOutput += `<main${bodyAttrs}>`;
      const bodyContent = Array.from(bodyNode.childNodes)
        .map((child) => nodeToHtml(child))
        .join('');
      htmlOutput += bodyContent;
      htmlOutput += `</main>`;
    } else if (!htmlOutput) {
      return '<p>No content</p>';
    }

    console.log('✓ Master JATS conversion completed - all attributes preserved');
    return htmlOutput;
  }
}

export function jatsToHtml(xml: string): string {
  try {
    // Step 1: Replace valid HTML entities with placeholders to protect them
    const entityMap: { [key: string]: string } = {};
    let placeholderIndex = 0;

    // List of valid HTML entities that might appear in the document
    const knownEntities = [
      'mdash', 'ndash', 'copy', 'reg', 'trade', 'nbsp', 'cent', 'pound', 'yen', 'euro',
      'deg', 'hellip', 'ldquo', 'rdquo', 'lsquo', 'rsquo', 'bull', 'rarr', 'larr',
      'uarr', 'darr', 'amp', 'lt', 'gt', 'quot', 'apos'
    ];

    let protectedXml = xml;
    
    // Replace each known entity with a unique placeholder
    knownEntities.forEach(entity => {
      const entityRegex = new RegExp(`&${entity};`, 'g');
      let match;
      while ((match = entityRegex.exec(protectedXml)) !== null) {
        const placeholder = `__ENTITY_PLACEHOLDER_${placeholderIndex}__`;
        entityMap[placeholder] = `&${entity};`;
        protectedXml = protectedXml.substring(0, match.index) + placeholder + protectedXml.substring(match.index + match[0].length);
        entityRegex.lastIndex = match.index + placeholder.length;
        placeholderIndex++;
      }
    });

    // Step 2: Escape ALL remaining ampersands
    protectedXml = protectedXml.replace(/&/g, '&amp;');

    // Step 3: Restore protected entities
    Object.entries(entityMap).forEach(([placeholder, entity]) => {
      protectedXml = protectedXml.replaceAll(placeholder, entity);
    });

    // Step 4: Convert HTML entities to numeric character references
    const htmlEntityMap: { [key: string]: string } = {
      '&mdash;': '&#8212;',    // em-dash
      '&ndash;': '&#8211;',    // en-dash
      '&copy;': '&#169;',      // copyright
      '&reg;': '&#174;',       // registered
      '&trade;': '&#8482;',    // trademark
      '&nbsp;': '&#160;',      // non-breaking space
      '&cent;': '&#162;',      // cent
      '&pound;': '&#163;',     // pound
      '&yen;': '&#165;',       // yen
      '&euro;': '&#8364;',     // euro
      '&deg;': '&#176;',       // degree
      '&hellip;': '&#8230;',   // ellipsis
      '&ldquo;': '&#8220;',    // left double quote
      '&rdquo;': '&#8221;',    // right double quote
      '&lsquo;': '&#8216;',    // left single quote
      '&rsquo;': '&#8217;',    // right single quote
      '&bull;': '&#8226;',     // bullet
      '&rarr;': '&#8594;',     // right arrow
      '&larr;': '&#8592;',     // left arrow
      '&uarr;': '&#8593;',     // up arrow
      '&darr;': '&#8595;',     // down arrow
    };

    let cleanedXml = protectedXml;
    Object.entries(htmlEntityMap).forEach(([entity, numeric]) => {
      cleanedXml = cleanedXml.replaceAll(entity, numeric);
    });

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(cleanedXml, 'application/xml');

    // Check for XML parsing errors
    const parseError = xmlDoc.getElementsByTagName('parsererror');
    if (parseError.length > 0) {
      const errorMsg = parseError[0].textContent || 'Unknown parsing error';
      console.error('XML Parsing error:', errorMsg);
      return '<p>Error parsing XML: ' + errorMsg + '</p>';
    }

    return processDocument(xmlDoc);
  } catch (err) {
    console.error('Fatal error in JATS conversion:', err);
    return '<p>Error converting JATS XML to HTML: ' + (err as Error).message + '</p>';
  }

  function processDocument(xmlDoc: XMLDocument): string {
    // Recursive conversion of XML → HTML
    function nodeToHtml(node: Node): string {
      try {
        if (node.nodeType === Node.TEXT_NODE) {
          // Only return non-empty text content
          const text = (node.textContent || '').trim();
          return text ? node.textContent || '' : '';
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const el = node as Element;
        const tagName = el.tagName.toLowerCase();

        // Render children in original order, filtering out empty text nodes
        const childrenHtml = Array.from(el.childNodes)
          .filter(child => {
            if (child.nodeType === Node.TEXT_NODE) {
              return (child.textContent || '').trim().length > 0;
            }
            return true;
          })
          .map((child) => nodeToHtml(child))
          .join('');

        switch (tagName) {

          case 'body':
            return childrenHtml;

          case 'p': {
            // Filter out graphics from paragraph content
            const pContent = Array.from(el.childNodes)
              .filter(child => {
                if (child.nodeType === Node.ELEMENT_NODE) {
                  return !['graphic', 'inline-graphic'].includes((child as Element).tagName.toLowerCase());
                }
                return child.nodeType === Node.TEXT_NODE ? (child.textContent || '').trim().length > 0 : true;
              })
              .map((child) => nodeToHtml(child))
              .join('');
            
            return pContent ? `<p>${pContent}</p>` : '';
          }

          case 'bold':
            return `<strong>${childrenHtml}</strong>`;

          case 'italic':
            return `<em>${childrenHtml}</em>`;

          case 'underline':
            return `<u>${childrenHtml}</u>`;

          case 'sub':
            return `<sub>${childrenHtml}</sub>`;

          case 'sup':
            return `<sup>${childrenHtml}</sup>`;

          case 'sec': {
            const titleEl = Array.from(el.children)
              .find(child => child.tagName.toLowerCase() === 'title');

            const title = titleEl?.textContent ?? '';
            const sectionId = el.getAttribute('id');

            // Render all children recursively (title handler will skip it)
            const contentHtml = Array.from(el.childNodes)
              .map(child => nodeToHtml(child))
              .join('');

            return `<section class="my-4"${sectionId ? ` id="${sectionId}"` : ''}>
              ${title ? `<h2 class="mb-3">${title}</h2>` : ''}
              ${contentHtml}
            </section>`;
          }

          case 'title':
            // Skip title when rendered at section level, already handled by parent
            return '';

          case 'disp-quote': {
            // Extract all graphics/figures before processing blockquote content
            const allGraphics: Element[] = [];
            
            // Collect graphics from all nested elements
            const collectGraphics = (elem: Element) => {
              Array.from(elem.children).forEach(child => {
                const childTag = child.tagName.toLowerCase();
                if (childTag === 'fig' || childTag === 'graphic' || childTag === 'inline-graphic') {
                  allGraphics.push(child);
                } else if (!['caption', 'label'].includes(childTag)) {
                  collectGraphics(child);
                }
              });
            };
            collectGraphics(el);

            // Process blockquote content without graphics
            const blockquoteContent = Array.from(el.childNodes)
              .filter(child => {
                if (child.nodeType === Node.ELEMENT_NODE) {
                  const tagName = (child as Element).tagName.toLowerCase();
                  return !['fig', 'graphic', 'inline-graphic'].includes(tagName);
                }
                return child.nodeType === Node.TEXT_NODE ? (child.textContent || '').trim().length > 0 : true;
              })
              .map((child) => nodeToHtml(child))
              .join('');

            // Process all graphics as separate figure blocks
            const mediaElements = allGraphics
              .map(graphic => {
                const tagName = graphic.tagName.toLowerCase();
                
                if (tagName === 'fig') {
                  return nodeToHtml(graphic);
                }
                
                // Handle standalone graphic/inline-graphic as figures
                const imgPath = graphic.getAttribute('xlink:href') || graphic.getAttribute('href') || '';
                const resolvedPath = resolveImagePath(imgPath);
                const figId = graphic.getAttribute('id') || '';
                const figIdAttr = figId ? ` id="${figId}"` : '';
                const dataIdAttr = figId ? ` data-id="${figId}"` : '';
                
                return `<figure class="figure border p-2 bg-light w-100 text-center mb-4"${figIdAttr}${dataIdAttr}>
                  ${resolvedPath ? `<img src="${resolvedPath}" class="figure-img img-fluid rounded" alt="">` : ''}
                </figure>`;
              })
              .join('');

            return `<blockquote class="blockquote">${blockquoteContent}</blockquote>${mediaElements}`;
          }

          case 'caption':
            // Render caption content
            return childrenHtml;

          case 'label':
            return `<strong>${childrenHtml}</strong>`;

          case 'fig': {
            let imgPath =
              el.querySelector('graphic')?.getAttribute('xlink:href') ||
              el.querySelector('graphic')?.getAttribute('href') ||
              '';

            imgPath = resolveImagePath(imgPath);
            console.log('Processed figure image path:', imgPath);
            const captionEl = el.querySelector('caption');
            const captionHtml = captionEl ? nodeToHtml(captionEl) : '';

            const figId = el.getAttribute('id') || '';
            const figIdAttr = figId ? ` id="${figId}"` : '';
            const dataIdAttr = figId ? ` data-id="${figId}"` : '';

            return `<figure class="figure border p-2 bg-light w-100 text-center mb-4"${figIdAttr}${dataIdAttr}>
              ${imgPath ? `<img src="${imgPath}" class="figure-img img-fluid rounded" alt="">` : ''}
              ${captionHtml ? `<figcaption class="figure-caption">${captionHtml}</figcaption>` : ''}
            </figure>`;
          }

          case 'graphic':
            return '';

          case 'list': {
            // Handle both ordered and unordered lists
            const listType = el.getAttribute('list-type') === 'ordered' ? 'ol' : 'ul';
            const itemsHtml = Array.from(el.children)
              .filter(child => child.tagName.toLowerCase() === 'list-item')
              .map(child => `<li>${nodeToHtml(child)}</li>`)
              .join('');
            return `<${listType} class="mb-3">${itemsHtml}</${listType}>`;
          }

          case 'list-item':
            return childrenHtml;

          case 'ext-link':
          case 'uri': {
            const href = el.getAttribute('xlink:href') || el.getAttribute('href') || '#';
            return `<a href="${href}" target="_blank">${childrenHtml}</a>`;
          }

          case 'xref': {
            const rid = el.getAttribute('rid');
            return `<a href="#${rid}">${childrenHtml}</a>`;
          }

          default:
            return childrenHtml;
        }
      } catch (err) {
        console.error('Error processing node:', node, err);
        return '';
      }
    }

    let htmlOutput = '';

    // Process front section (title, authors, abstract)
    const frontNode = xmlDoc.getElementsByTagName('front')[0];
    if (frontNode) {
      const articleMeta = frontNode.getElementsByTagName('article-meta')[0];
      if (articleMeta) {
        // Article Title
        const titleGroup = articleMeta.getElementsByTagName('title-group')[0];
        if (titleGroup) {
          const articleTitle = titleGroup.getElementsByTagName('article-title')[0]?.textContent ?? '';
          if (articleTitle) {
            htmlOutput += `<h1 class="mb-3">${articleTitle}</h1>`;
          }

          const altTitle = titleGroup.getElementsByTagName('alt-title')[0]?.textContent ?? '';
          if (altTitle) {
            htmlOutput += `<p class="lead text-muted mb-4">${altTitle}</p>`;
          }
        }

        // Authors
        const contribGroup = articleMeta.getElementsByTagName('contrib-group')[0];
        if (contribGroup) {
          const contribs = Array.from(contribGroup.getElementsByTagName('contrib'));
          contribs.forEach((contrib) => {
            const name = contrib.getElementsByTagName('name')[0];
            const bio = contrib.getElementsByTagName('bio')[0];
            if (name) {
              const surname = name.getElementsByTagName('surname')[0]?.textContent ?? '';
              const givenNames = name.getElementsByTagName('given-names')[0]?.textContent ?? '';
              htmlOutput += `<p class="fw-bold">${givenNames} ${surname}</p>`;
            }
            if (bio) {
              const bioContent = Array.from(bio.childNodes)
                .map((child) => nodeToHtml(child))
                .join('');
              htmlOutput += bioContent;
            }
          });
        }

        // Abstract
        const abstract = articleMeta.getElementsByTagName('abstract')[0];
        if (abstract) {
          htmlOutput += `<div class="alert alert-info mb-4"><strong>Abstract</strong>`;
          const abstractContent = Array.from(abstract.childNodes)
            .filter((child: any) => child.nodeType !== Node.ELEMENT_NODE || child.tagName !== 'title')
            .map((child) => nodeToHtml(child))
            .join('');
          htmlOutput += abstractContent;
          htmlOutput += `</div>`;
        }
      }
    }

    // Process body section
    const bodyNode = xmlDoc.getElementsByTagName('body')[0];
    if (bodyNode) {
      htmlOutput += nodeToHtml(bodyNode);
    } else if (!htmlOutput) {
      return '<p>No content</p>';
    }

    console.log('✓ JATS conversion completed successfully');
    return htmlOutput;
  }
}
