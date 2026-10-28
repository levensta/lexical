/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {LexicalEditor} from 'lexical';

import {namedSignals} from '@lexical/extension';
import {effect, type Signal} from '@lexical/extension';
import {$findMatchingParent} from '@lexical/utils';
import {
  $getSelection,
  $isRangeSelection,
  defineExtension,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  registerEventListeners,
  safeCast,
} from 'lexical';

import {$isListItemNode} from './LexicalListItemNode';

const DEFAULT_SWIPE_THRESHOLD = 50;
const DEFAULT_VERTICAL_GUARD = 30;

function $isSelectionInListItem(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return false;
  }
  const node = selection.anchor.getNode();
  const listItem = $findMatchingParent(node, $isListItemNode);
  return listItem != null;
}

function registerTouchIndentation(
  editor: LexicalEditor,
  swipeThreshold: Signal<number>,
): () => void {
  return editor.registerRootListener(rootElement => {
    if (rootElement !== null) {
      let startX = 0;
      let startY = 0;
      let isSwiping = false;
      let isInListItem = false;

      const handleTouchStart = (event: TouchEvent) => {
        if (event.touches.length > 1) {
          return;
        }
        const touch = event.touches[0];
        if (touch != null && editor.isEditable()) {
          startX = touch.clientX;
          startY = touch.clientY;
          isSwiping = false;
          isInListItem = editor.read($isSelectionInListItem);
        }
      };

      const handleTouchMove = (event: TouchEvent) => {
        if (!isInListItem || event.touches.length > 1) {
          return;
        }
        const touch = event.touches[0];
        if (touch != null) {
          const deltaX = touch.clientX - startX;
          const deltaY = touch.clientY - startY;
          if (
            Math.abs(deltaX) > swipeThreshold.peek() &&
            Math.abs(deltaY) < DEFAULT_VERTICAL_GUARD
          ) {
            isSwiping = true;
            event.preventDefault();
          }
        }
      };

      const handleTouchEnd = (event: TouchEvent) => {
        if (!isSwiping) {
          isSwiping = false;
          isInListItem = false;
          return;
        }
        const touch = event.changedTouches[0];
        if (touch != null) {
          const deltaX = touch.clientX - startX;
          const deltaY = touch.clientY - startY;
          if (
            Math.abs(deltaX) > swipeThreshold.peek() &&
            Math.abs(deltaY) < DEFAULT_VERTICAL_GUARD
          ) {
            event.preventDefault();
            editor.dispatchCommand(
              deltaX > 0 ? INDENT_CONTENT_COMMAND : OUTDENT_CONTENT_COMMAND,
              undefined,
            );
          }
        }
        isSwiping = false;
        isInListItem = false;
      };

      return registerEventListeners(
        rootElement,
        {
          touchend: handleTouchEnd,
          touchmove: handleTouchMove,
          touchstart: handleTouchStart,
        },
        {
          capture: true,
          passive: false,
        },
      );
    }
  });
}

export interface TouchIndentationConfig {
  /**
   * Turns swipe-to-indent off when `true`. Defaults to `false`.
   * This can be changed at runtime and takes effect immediately.
   */
  disabled: boolean;
  /**
   * The minimum horizontal distance, in pixels, a finger must travel
   * before a swipe counts as an indent or outdent. Defaults to `50`.
   *
   * Lower values make swiping more sensitive. Higher values require a
   * longer swipe and help avoid accidental indents.
   */
  swipeThreshold: number;
}

/**
 * Adds swipe gestures for indenting list items on touch devices.
 *
 * When the cursor is inside a list item, swiping right with one finger
 * indents the item and swiping left outdents it. The gesture only counts
 * if the swipe is mostly horizontal, so normal vertical scrolling and
 * text selection are not affected. Swipes are ignored when the editor is
 * read-only or when more than one finger is touching the screen.
 */
export const TouchIndentationExtension = defineExtension({
  build(editor, config, state) {
    return namedSignals(config);
  },
  config: safeCast<TouchIndentationConfig>({
    disabled: false,
    swipeThreshold: DEFAULT_SWIPE_THRESHOLD,
  }),
  name: '@lexical/extension/TouchIndentation',
  register(editor, config, state) {
    const {disabled, swipeThreshold} = state.getOutput();
    return effect(() => {
      if (!disabled.value) {
        return registerTouchIndentation(editor, swipeThreshold);
      }
    });
  },
});
