import { Plugin } from 'prosemirror-state';
import { NodeSelection, Selection } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

/**
 * Plugin to handle image and figure selection in the editor
 * Shows outline and resize handles when an image/figure is selected
 */
export const imageSelectionPlugin = () => {
  return new Plugin({
    props: {
      decorations(state) {
        const { doc, selection } = state;
        const decorations: Decoration[] = [];

        // Check if the selection is a NodeSelection on an image or figure node
        if (selection instanceof NodeSelection) {
          const node = selection.node;
          if (
            node.type.name === 'image' ||
            node.type.name === 'figure' ||
            (node.type.name === 'paragraph' && node.firstChild?.type.name === 'image')
          ) {
            // Add decoration to highlight the selected node
            decorations.push(
              Decoration.node(selection.from, selection.to, {
                class: 'ProseMirror-selectednode'
              })
            );
          }
        }

        return decorations.length > 0 ? DecorationSet.create(doc, decorations) : DecorationSet.empty;
      },

      handleDOMEvents: {
        click(view, event) {
          const target = event.target as HTMLElement;

          // Check if clicked on an image
          if (target.tagName === 'IMG') {
            const pos = view.posAtDOM(target, 0);
            const $pos = view.state.doc.resolve(pos);
            
            // Try to select parent node if it's an image or figure
            let nodePos = pos;
            let node = $pos.parent;

            // If parent is a paragraph with image, try to select the image specifically
            if (node.type.name === 'paragraph' && node.firstChild?.type.name === 'image') {
              nodePos = $pos.before($pos.depth) + 1;
              node = node.firstChild;
            } else if (node.type.name === 'image') {
              nodePos = $pos.before($pos.depth);
            } else if (node.type.name === 'figure') {
              nodePos = $pos.before($pos.depth);
            } else {
              return false;
            }

            // Create a NodeSelection for the image or figure
            const tr = view.state.tr.setSelection(
              NodeSelection.create(view.state.doc, nodePos)
            );
            view.dispatch(tr);
            return true;
          }

          // Check if clicked on a figure
          if (target.tagName === 'FIGURE' || target.closest('figure')) {
            const figureEl = target.tagName === 'FIGURE' ? target : target.closest('figure');
            if (!figureEl) return false;

            const pos = view.posAtDOM(figureEl, 0);
            const $pos = view.state.doc.resolve(pos);
            const node = $pos.parent;

            if (node.type.name === 'figure') {
              const figurePos = $pos.before($pos.depth);
              const tr = view.state.tr.setSelection(
                NodeSelection.create(view.state.doc, figurePos)
              );
              view.dispatch(tr);
              return true;
            }
          }

          return false;
        }
      }
    }
  });
};

