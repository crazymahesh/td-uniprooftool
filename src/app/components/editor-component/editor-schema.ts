// editor-schema.ts
import { Schema } from 'prosemirror-model';
import { tableNodes } from 'prosemirror-tables';

// 🔹 Preferred: extend ngx-editor's schema if it's exported in your version
// If your build fails on this import, see the fallback below.
import { schema as ngxSchema } from 'ngx-editor/schema';

/**
 * Create a new schema by appending table nodes to ngx-editor's schema.
 * cellContent: 'block+' allows multiple blocks inside a cell (paragraphs, lists, images, etc.)
 * tableHeader is included by default; we’ll use it for the first row if desired.
 */
const tables = tableNodes({
  tableGroup: 'block',
  cellContent: 'block+',
  cellAttributes: {
    style: {
      default: null,
      getFromDOM(dom: HTMLElement) {
        return dom.getAttribute('style') || null;
      },
      setDOMAttr(value: unknown, attrs: any) {
        if (typeof value === 'string' || value === null) {
          if (value) attrs.style = value;
        }
      },
    },
  },
});

const nodes = ngxSchema.spec.nodes.append(tables);

export const tableSchema = new Schema({
  nodes,
  marks: ngxSchema.spec.marks.append({
    insertion: {
      attrs: { id: { default: null } },
      parseDOM: [{ tag: 'span.insertion', getAttrs: (dom: any) => ({ id: dom.getAttribute('data-id') }) }],
      toDOM(mark) { return ['span', { class: 'insertion', 'data-id': mark.attrs['id'], style: 'color: green; text-decoration: underline;' }, 0]; }
    },
    deletion: {
      attrs: { id: { default: null } },
      parseDOM: [{ tag: 'span.deletion', getAttrs: (dom: any) => ({ id: dom.getAttribute('data-id') }) }],
      toDOM(mark) { return ['span', { class: 'deletion', 'data-id': mark.attrs['id'], style: 'color: red; text-decoration: line-through;' }, 0]; }
    }
  }),
});

/**
 * Fallback if your ngx-editor version does NOT export a schema at 'ngx-editor/schema':
 *
 * - Comment out the ngx import & above block.
 * - Import and merge from prosemirror basic/list and recreate the marks you need.
 * - Ping me and I’ll generate a compatible schema that includes link/image/color/align marks
 *   so your toolbar items keep working.
 */