const XLINK_NS = 'http://www.w3.org/1999/xlink';

function sanitizeTemplateXmlForParsing(xml: string): string {
  // Convert common HTML entities to numeric references so XML parsing stays strict but tolerant.
  const htmlEntityMap: Record<string, string> = {
    '&nbsp;': '&#160;',
    '&mdash;': '&#8212;',
    '&ndash;': '&#8211;',
    '&hellip;': '&#8230;',
    '&ldquo;': '&#8220;',
    '&rdquo;': '&#8221;',
    '&lsquo;': '&#8216;',
    '&rsquo;': '&#8217;'
  };

  let sanitized = xml;
  Object.entries(htmlEntityMap).forEach(([entity, numeric]) => {
    sanitized = sanitized.replaceAll(entity, numeric);
  });

  // Escape every ampersand that is not part of a valid XML entity reference.
  // This handles source text like "R&D" that otherwise breaks DOMParser(application/xml).
  sanitized = sanitized.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');

  return sanitized;
}

function findElementByLocalName(parent: Document | Element, localName: string): Element | null {
  const children = parent.childNodes;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }

    const el = child as Element;
    const currentName = (el.localName || el.tagName).toLowerCase();
    if (currentName === localName.toLowerCase()) {
      return el;
    }

    const nested = findElementByLocalName(el, localName);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function appendConvertedChildren(
  sourceNodes: NodeListOf<ChildNode> | ChildNode[],
  target: Element,
  xmlDoc: XMLDocument,
  ns: string | null
): void {
  Array.from(sourceNodes).forEach((child) => {
    const converted = convertHtmlNodeToJats(child, xmlDoc, ns);
    converted.forEach((node) => target.appendChild(node));
  });
}

function createElement(xmlDoc: XMLDocument, ns: string | null, name: string): Element {
  return ns ? xmlDoc.createElementNS(ns, name) : xmlDoc.createElement(name);
}

function normalizeGraphicPath(path: string): string {
  if (!path) {
    return path;
  }

  return path
    .replace(/^\/?img\/xml-img\//i, '')
    .replace(/^\/?public\/img\/xml-img\//i, '')
    .trim();
}

function buildGraphicFromImage(imgEl: Element, xmlDoc: XMLDocument, ns: string | null): Element {
  const graphic = createElement(xmlDoc, ns, 'graphic');
  const src = imgEl.getAttribute('src') || '';
  const href = normalizeGraphicPath(src);

  if (href) {
    graphic.setAttributeNS(XLINK_NS, 'xlink:href', href);
  }

  return graphic;
}

function convertTableChild(node: Node, xmlDoc: XMLDocument, ns: string | null): Node[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    return text.trim() ? [xmlDoc.createTextNode(text)] : [];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return [];
  }

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (!['thead', 'tbody', 'tr', 'th', 'td'].includes(tag)) {
    return [];
  }

  const out = createElement(xmlDoc, ns, tag);
  appendConvertedChildren(el.childNodes as NodeListOf<ChildNode>, out, xmlDoc, ns);
  return [out];
}

function convertHtmlNodeToJats(node: Node, xmlDoc: XMLDocument, ns: string | null): Node[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    return text.trim() ? [xmlDoc.createTextNode(text)] : [];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return [];
  }

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  switch (tag) {
    case 'main':
    case 'article':
    case 'div': {
      const nodes: Node[] = [];
      Array.from(el.childNodes).forEach((child) => {
        nodes.push(...convertHtmlNodeToJats(child, xmlDoc, ns));
      });
      return nodes;
    }

    case 'p': {
      const p = createElement(xmlDoc, ns, 'p');
      appendConvertedChildren(el.childNodes as NodeListOf<ChildNode>, p, xmlDoc, ns);
      return [p];
    }

    case 'strong':
    case 'b': {
      const bold = createElement(xmlDoc, ns, 'bold');
      appendConvertedChildren(el.childNodes as NodeListOf<ChildNode>, bold, xmlDoc, ns);
      return [bold];
    }

    case 'em':
    case 'i': {
      const italic = createElement(xmlDoc, ns, 'italic');
      appendConvertedChildren(el.childNodes as NodeListOf<ChildNode>, italic, xmlDoc, ns);
      return [italic];
    }

    case 'u': {
      const underline = createElement(xmlDoc, ns, 'underline');
      appendConvertedChildren(el.childNodes as NodeListOf<ChildNode>, underline, xmlDoc, ns);
      return [underline];
    }

    case 'sub':
    case 'sup': {
      const out = createElement(xmlDoc, ns, tag);
      appendConvertedChildren(el.childNodes as NodeListOf<ChildNode>, out, xmlDoc, ns);
      return [out];
    }

    case 'blockquote': {
      const quote = createElement(xmlDoc, ns, 'disp-quote');
      appendConvertedChildren(el.childNodes as NodeListOf<ChildNode>, quote, xmlDoc, ns);
      return [quote];
    }

    case 'section': {
      const sec = createElement(xmlDoc, ns, 'sec');
      const secId = el.getAttribute('id');
      if (secId) {
        sec.setAttribute('id', secId);
      }

      let titleAdded = false;
      Array.from(el.childNodes).forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const childEl = child as Element;
          const childTag = childEl.tagName.toLowerCase();

          if (!titleAdded && /^h[1-6]$/.test(childTag)) {
            const titleText = (childEl.textContent || '').trim();
            if (titleText) {
              const title = createElement(xmlDoc, ns, 'title');
              title.appendChild(xmlDoc.createTextNode(titleText));
              sec.appendChild(title);
              titleAdded = true;
            }
            return;
          }
        }

        const converted = convertHtmlNodeToJats(child, xmlDoc, ns);
        converted.forEach((n) => sec.appendChild(n));
      });

      return [sec];
    }

    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const sec = createElement(xmlDoc, ns, 'sec');
      const title = createElement(xmlDoc, ns, 'title');
      title.appendChild(xmlDoc.createTextNode((el.textContent || '').trim()));
      sec.appendChild(title);
      return [sec];
    }

    case 'ul':
    case 'ol': {
      const list = createElement(xmlDoc, ns, 'list');
      list.setAttribute('list-type', tag === 'ol' ? 'ordered' : 'bullet');

      Array.from(el.children)
        .filter((child) => child.tagName.toLowerCase() === 'li')
        .forEach((li) => {
          const convertedLi = convertHtmlNodeToJats(li, xmlDoc, ns);
          convertedLi.forEach((n) => list.appendChild(n));
        });

      return [list];
    }

    case 'li': {
      const listItem = createElement(xmlDoc, ns, 'list-item');
      const p = createElement(xmlDoc, ns, 'p');
      appendConvertedChildren(el.childNodes as NodeListOf<ChildNode>, p, xmlDoc, ns);

      if (p.childNodes.length > 0) {
        listItem.appendChild(p);
      }

      return [listItem];
    }

    case 'a': {
      const href = el.getAttribute('href') || '';

      if (href.startsWith('#')) {
        const xref = createElement(xmlDoc, ns, 'xref');
        xref.setAttribute('rid', href.slice(1));
        appendConvertedChildren(el.childNodes as NodeListOf<ChildNode>, xref, xmlDoc, ns);
        return [xref];
      }

      const extLink = createElement(xmlDoc, ns, 'ext-link');
      extLink.setAttribute('ext-link-type', 'uri');
      if (href) {
        extLink.setAttributeNS(XLINK_NS, 'xlink:href', href);
      }
      appendConvertedChildren(el.childNodes as NodeListOf<ChildNode>, extLink, xmlDoc, ns);
      return [extLink];
    }

    case 'figure': {
      const fig = createElement(xmlDoc, ns, 'fig');
      const id = el.getAttribute('id') || el.getAttribute('data-id');
      if (id) {
        fig.setAttribute('id', id);
      }

      const captionEl = el.querySelector('figcaption');
      if (captionEl) {
        const caption = createElement(xmlDoc, ns, 'caption');
        const captionP = createElement(xmlDoc, ns, 'p');
        appendConvertedChildren(captionEl.childNodes as NodeListOf<ChildNode>, captionP, xmlDoc, ns);
        if (captionP.childNodes.length > 0) {
          caption.appendChild(captionP);
          fig.appendChild(caption);
        }
      }

      const imgEl = el.querySelector('img');
      if (imgEl) {
        fig.appendChild(buildGraphicFromImage(imgEl, xmlDoc, ns));
      }

      return [fig];
    }

    case 'img': {
      const fig = createElement(xmlDoc, ns, 'fig');
      fig.appendChild(buildGraphicFromImage(el, xmlDoc, ns));
      return [fig];
    }

    case 'table': {
      const tableWrap = createElement(xmlDoc, ns, 'table-wrap');
      const table = createElement(xmlDoc, ns, 'table');

      Array.from(el.childNodes).forEach((child) => {
        const converted = convertTableChild(child, xmlDoc, ns);
        converted.forEach((n) => table.appendChild(n));
      });

      tableWrap.appendChild(table);
      return [tableWrap];
    }

    case 'thead':
    case 'tbody':
    case 'tr':
    case 'th':
    case 'td': {
      const out = createElement(xmlDoc, ns, tag);
      appendConvertedChildren(el.childNodes as NodeListOf<ChildNode>, out, xmlDoc, ns);
      return [out];
    }

    case 'span': {
      const className = el.getAttribute('class') || '';

      if (className.includes('search-highlight')) {
        const nodes: Node[] = [];
        Array.from(el.childNodes).forEach((child) => {
          nodes.push(...convertHtmlNodeToJats(child, xmlDoc, ns));
        });
        return nodes;
      }

      if (className.includes('citation')) {
        const xref = createElement(xmlDoc, ns, 'xref');
        const citationId = el.getAttribute('data-citation-id') || '';
        if (citationId) {
          xref.setAttribute('rid', citationId);
          xref.setAttribute('ref-type', 'bibr');
        }
        appendConvertedChildren(el.childNodes as NodeListOf<ChildNode>, xref, xmlDoc, ns);
        return [xref];
      }

      const nodes: Node[] = [];
      Array.from(el.childNodes).forEach((child) => {
        nodes.push(...convertHtmlNodeToJats(child, xmlDoc, ns));
      });
      return nodes;
    }

    default: {
      const nodes: Node[] = [];
      Array.from(el.childNodes).forEach((child) => {
        nodes.push(...convertHtmlNodeToJats(child, xmlDoc, ns));
      });
      return nodes;
    }
  }
}

/**
 * Converts editor HTML back to JATS XML and preserves original metadata/front structure.
 */
export function htmlToJatsWithTemplate(htmlContent: string, templateJatsXml: string): string {
  const xmlParser = new DOMParser();
  const htmlParser = new DOMParser();

  const safeTemplate = sanitizeTemplateXmlForParsing(templateJatsXml);
  const xmlDoc = xmlParser.parseFromString(safeTemplate, 'application/xml');
  const parseErrors = xmlDoc.getElementsByTagName('parsererror');
  if (parseErrors.length > 0) {
    throw new Error(parseErrors[0].textContent || 'Unable to parse template JATS XML');
  }

  const article = findElementByLocalName(xmlDoc, 'article');
  if (!article) {
    throw new Error('Template JATS XML does not contain an article element');
  }

  const body = findElementByLocalName(article, 'body');
  if (!body) {
    throw new Error('Template JATS XML does not contain a body element');
  }

  const articleNs = article.namespaceURI || null;

  const htmlDoc = htmlParser.parseFromString(htmlContent || '', 'text/html');
  const mainEl = htmlDoc.querySelector('main');
  const contentRoot = mainEl || htmlDoc.body;

  while (body.firstChild) {
    body.removeChild(body.firstChild);
  }

  appendConvertedChildren(contentRoot.childNodes as NodeListOf<ChildNode>, body, xmlDoc, articleNs);

  if (!body.childNodes.length) {
    const emptyP = createElement(xmlDoc, articleNs, 'p');
    body.appendChild(emptyP);
  }

  const serializer = new XMLSerializer();
  const serialized = serializer.serializeToString(xmlDoc);

  const xmlDeclMatch = templateJatsXml.match(/^\s*(<\?xml[^>]*\?>)/i);
  const xmlDecl = xmlDeclMatch ? `${xmlDeclMatch[1]}\n` : '';

  return `${xmlDecl}${serialized}`;
}
