import { Plugin, PluginKey, Transaction } from 'prosemirror-state';
import { EditorState } from 'prosemirror-state';
import { Schema, MarkType } from 'prosemirror-model';

export const trackChangesPluginKey = new PluginKey('track-changes');

export function trackChangesPlugin(schema: Schema, trackChangesService: any) {
    let updateTimer: any = null;

    const notifyService = (state: EditorState) => {
        if (updateTimer) clearTimeout(updateTimer);
        updateTimer = setTimeout(() => {
            const changes: any[] = [];
            state.doc.descendants((node, pos) => {
                if (node.isText) {
                    node.marks.forEach(mark => {
                        if (mark.type.name === 'insertion' || mark.type.name === 'deletion') {
                            changes.push({
                                id: mark.attrs['id'] || Math.random().toString(36).substr(2, 9),
                                type: mark.type.name === 'insertion' ? 'insert' : 'delete',
                                content: node.text,
                                from: pos,
                                to: pos + node.nodeSize,
                                author: 'Author',
                                timestamp: new Date()
                            });
                        }
                    });
                }
            });
            trackChangesService.updateChanges(changes);
        }, 300); // 300ms debounce
    };

    return new Plugin({
        key: trackChangesPluginKey,
        appendTransaction(transactions, oldState, newState) {
            if (transactions.some(tr => tr.getMeta('track-changes-skip'))) {
                return null;
            }

            if (!transactions.some(tr => tr.docChanged)) return null;

            notifyService(newState);
            return null;
        },

        props: {
            handleKeyDown(view, event) {
                if (event.key === 'Backspace' || event.key === 'Delete') {
                    const { state, dispatch } = view;
                    const { selection, tr } = state;

                    let from = selection.from;
                    let to = selection.to;

                    if (selection.empty) {
                        if (event.key === 'Backspace') {
                            if (from <= 1) return false;
                            from = from - 1;
                        } else {
                            if (to >= state.doc.content.size) return false;
                            to = to + 1;
                        }
                    }

                    const deletionMark = schema.marks['deletion'].create({ id: Math.random().toString(36).substr(2, 9) });
                    dispatch(tr.addMark(from, to, deletionMark).setMeta('track-changes-skip', true));
                    return true;
                }
                return false;
            },
            handleTextInput(view, from, to, text) {
                const { state, dispatch } = view;
                const insertionMark = schema.marks['insertion'].create({ id: Math.random().toString(36).substr(2, 9) });
                const tr = state.tr.insertText(text, from, to);
                tr.addMark(from, from + text.length, insertionMark);
                tr.setMeta('track-changes-skip', true);
                dispatch(tr);
                return true;
            }
        }
    });
}
