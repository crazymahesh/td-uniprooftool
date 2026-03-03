import { Command } from 'prosemirror-state';
import { Mark } from 'prosemirror-model';
import { toggleMark } from 'prosemirror-commands';

/**
 * Citation command - toggles citation mark on selected text
 */
export const toggleCitation = (citationId: string, label: string): Command => (state, dispatch) => {
  const { doc, selection, tr } = state;
  const { from, to } = selection;

  if (from === to) {
    console.warn('No text selected for citation');
    return false;
  }

  const mark = state.schema.marks['citation'].create({
    id: citationId,
    label: label
  });

  let hasMark = false;
  doc.nodesBetween(from, to, (node) => {
    if (mark.isInSet(node.marks)) {
      hasMark = true;
    }
  });

  if (hasMark) {
    // Remove citation mark if it already exists
    tr.removeMark(from, to, state.schema.marks['citation']);
  } else {
    // Add citation mark
    tr.addMark(from, to, mark);
  }

  if (dispatch) {
    dispatch(tr);
  }

  return true;
};

/**
 * Remove citation mark from selection
 */
export const removeCitation: Command = (state, dispatch) => {
  const { selection, tr } = state;
  const { from, to } = selection;

  tr.removeMark(from, to, state.schema.marks['citation']);

  if (dispatch) {
    dispatch(tr);
  }

  return true;
};

/**
 * Update citation ID and label
 */
export const updateCitation = (citationId: string, label: string): Command => (state, dispatch) => {
  const { selection, tr } = state;
  const { from, to } = selection;

  // Remove old citation mark
  tr.removeMark(from, to, state.schema.marks['citation']);

  // Add new citation mark with updated attributes
  const mark = state.schema.marks['citation'].create({
    id: citationId,
    label: label
  });

  tr.addMark(from, to, mark);

  if (dispatch) {
    dispatch(tr);
  }

  return true;
};

/**
 * Get citation information from current selection or nearest mark
 */
export const getCitationAtSelection = (state: any) => {
  const { from, to } = state.selection;
  let citationMark: Mark | undefined;

  state.doc.nodesBetween(from, to, (node: any) => {
    const mark = node.marks.find((m: Mark) => m.type.name === 'citation');
    if (mark) {
      citationMark = mark;
    }
  });

  if (citationMark) {
    return {
      id: citationMark.attrs['id'],
      label: citationMark.attrs['label']
    };
  }

  return null;
};
