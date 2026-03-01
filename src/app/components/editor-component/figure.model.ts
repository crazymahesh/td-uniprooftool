/**
 * Figure metadata extracted from JATS XML
 */
export interface FigureMetadata {
  id: string;           // Figure ID from XML (e.g., "ME-2025-Oct1-f001")
  label?: string;       // Figure label/name (e.g., "Figure 1")
  caption?: string;     // Figure caption text
  imagePath?: string;   // Path to the image file
  version?: string;     // Version information extracted from ID or caption
}

/**
 * Extract all figures from JATS XML
 */
export function extractFiguresFromXml(xml: string): FigureMetadata[] {
  try {
    // Apply same entity protection as jatsToHtmlMaster
    const protectedXml = protectXmlEntities(xml);

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(protectedXml, 'application/xml');

    // Check for parsing errors
    const parseError = xmlDoc.getElementsByTagName('parsererror');
    if (parseError.length > 0) {
      console.error('XML parsing error:', parseError[0].textContent);
      return [];
    }

    const figures: FigureMetadata[] = [];
    const figElements = xmlDoc.getElementsByTagName('fig');

    for (let i = 0; i < figElements.length; i++) {
      const figEl = figElements[i] as Element;
      const figMetadata = extractFigureMetadata(figEl, i + 1);
      if (figMetadata.id) {
        figures.push(figMetadata);
      }
    }

    return figures;
  } catch (err) {
    console.error('Error extracting figures from XML:', err);
    return [];
  }
}

/**
 * Protect XML entities from malformed parsing
 */
function protectXmlEntities(xml: string): string {
  const entityMap: { [key: string]: string } = {};
  let placeholderIndex = 0;

  // List of valid HTML entities to protect
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

  // Escape all remaining ampersands
  protectedXml = protectedXml.replace(/&/g, '&amp;');

  // Restore protected entities
  Object.entries(entityMap).forEach(([placeholder, entity]) => {
    protectedXml = protectedXml.replaceAll(placeholder, entity);
  });

  // Convert HTML entities to numeric character references
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

  return cleanedXml;
}

/**
 * Extract metadata from a single figure element
 */
function extractFigureMetadata(figEl: Element, figureNumber: number): FigureMetadata {
  const figMetadata: FigureMetadata = {
    id: figEl.getAttribute('id') || `figure-${figureNumber}`,
  };

  // Extract label
  const labelEl = figEl.querySelector('label');
  if (labelEl) {
    figMetadata.label = labelEl.textContent?.trim() || `Figure ${figureNumber}`;
  } else {
    figMetadata.label = `Figure ${figureNumber}`;
  }

  // Extract caption
  const captionEl = figEl.querySelector('caption');
  if (captionEl) {
    const titleEl = captionEl.querySelector('title');
    const paraEl = captionEl.querySelector('p');
    
    if (titleEl) {
      figMetadata.caption = titleEl.textContent?.trim();
    } else if (paraEl) {
      figMetadata.caption = paraEl.textContent?.trim();
    } else {
      figMetadata.caption = captionEl.textContent?.trim();
    }
  }

  // Extract image path
  const graphicEl = figEl.querySelector('graphic');
  if (graphicEl) {
    const href = graphicEl.getAttribute('xlink:href') || 
                 graphicEl.getAttribute('href');
    if (href) {
      figMetadata.imagePath = href.startsWith('/') ? href : `/img/xml-img/${href}`;
    }
  }

  // Extract version from ID (e.g., "ME-2025-Oct1-f001" -> version: "001")
  const idMatch = figMetadata.id.match(/-f(\d+)$/);
  if (idMatch) {
    figMetadata.version = idMatch[1];
  }

  return figMetadata;
}
