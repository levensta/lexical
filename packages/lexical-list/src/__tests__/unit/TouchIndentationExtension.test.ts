/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  buildEditorFromExtensions,
  TouchIndentationExtension,
} from '@lexical/extension';
import {
  $createListItemNode,
  $createListNode,
  ListExtension,
} from '@lexical/list';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  configExtension,
  defineExtension,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
} from 'lexical';
import {assert, describe, expect, it, vi} from 'vitest';

function createTouchEvent(type: string, x: number, y: number): Event {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  });
  const touchData = {
    clientX: x,
    clientY: y,
    identifier: 0,
    target: document.body,
  };
  if (type === 'touchend') {
    Object.defineProperty(event, 'changedTouches', {value: [touchData]});
    Object.defineProperty(event, 'touches', {value: []});
  } else {
    Object.defineProperty(event, 'touches', {value: [touchData]});
    Object.defineProperty(event, 'changedTouches', {value: [touchData]});
  }
  return event;
}

function simulateSwipe(
  element: HTMLElement,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
) {
  element.dispatchEvent(createTouchEvent('touchstart', startX, startY));
  element.dispatchEvent(createTouchEvent('touchmove', endX, endY));
  element.dispatchEvent(createTouchEvent('touchend', endX, endY));
}

function $initialEditorStateWithList() {
  const list = $createListNode('bullet');
  const item = $createListItemNode();
  item.append($createTextNode('Hello'));
  list.append(item);
  $getRoot().append(list);
  item.selectEnd();
}

describe('TouchIndentationExtension', () => {
  it('dispatches INDENT_CONTENT_COMMAND on swipe right in list item', () => {
    using editor = buildEditorFromExtensions(
      defineExtension({
        $initialEditorState: $initialEditorStateWithList,
        dependencies: [TouchIndentationExtension, ListExtension],
        name: 'test',
      }),
    );
    const indentHandler = vi.fn(() => true);

    editor.registerCommand(INDENT_CONTENT_COMMAND, indentHandler, 1);

    const root = editor.getRootElement();
    assert(root !== null);
    simulateSwipe(root, 100, 200, 200, 200);

    expect(indentHandler).toHaveBeenCalledTimes(1);
  });

  it('dispatches OUTDENT_CONTENT_COMMAND on swipe left in list item', () => {
    using editor = buildEditorFromExtensions(
      defineExtension({
        $initialEditorState: $initialEditorStateWithList,
        dependencies: [TouchIndentationExtension, ListExtension],
        name: 'test',
      }),
    );
    const outdentHandler = vi.fn(() => true);

    editor.registerCommand(OUTDENT_CONTENT_COMMAND, outdentHandler, 1);

    const root = editor.getRootElement();
    assert(root !== null);
    simulateSwipe(root, 200, 200, 50, 200);

    expect(outdentHandler).toHaveBeenCalledTimes(1);
  });

  it('does NOT trigger on paragraph (non-list) content', () => {
    using editor = buildEditorFromExtensions(
      defineExtension({
        $initialEditorState() {
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode('Hello'));
          $getRoot().append(paragraph);
          paragraph.selectEnd();
        },
        dependencies: [TouchIndentationExtension, ListExtension],
        name: 'test',
      }),
    );
    const indentHandler = vi.fn(() => true);
    const outdentHandler = vi.fn(() => true);

    editor.registerCommand(INDENT_CONTENT_COMMAND, indentHandler, 1);
    editor.registerCommand(OUTDENT_CONTENT_COMMAND, outdentHandler, 1);

    const root = editor.getRootElement();
    assert(root !== null);
    simulateSwipe(root, 100, 200, 200, 200);

    expect(indentHandler).not.toHaveBeenCalled();
    expect(outdentHandler).not.toHaveBeenCalled();
  });

  it('does NOT trigger on vertical swipe (scroll)', () => {
    using editor = buildEditorFromExtensions(
      defineExtension({
        $initialEditorState: $initialEditorStateWithList,
        dependencies: [TouchIndentationExtension, ListExtension],
        name: 'test',
      }),
    );
    const indentHandler = vi.fn(() => true);

    editor.registerCommand(INDENT_CONTENT_COMMAND, indentHandler, 1);

    const root = editor.getRootElement();
    assert(root !== null);
    simulateSwipe(root, 100, 100, 120, 300);

    expect(indentHandler).not.toHaveBeenCalled();
  });

  it('does NOT trigger when horizontal movement is below threshold', () => {
    using editor = buildEditorFromExtensions(
      defineExtension({
        $initialEditorState: $initialEditorStateWithList,
        dependencies: [TouchIndentationExtension, ListExtension],
        name: 'test',
      }),
    );
    const indentHandler = vi.fn(() => true);

    editor.registerCommand(INDENT_CONTENT_COMMAND, indentHandler, 1);

    const root = editor.getRootElement();
    assert(root !== null);
    simulateSwipe(root, 100, 200, 130, 200);

    expect(indentHandler).not.toHaveBeenCalled();
  });

  it('respects custom swipeThreshold', () => {
    using editor = buildEditorFromExtensions(
      defineExtension({
        $initialEditorState: () => {
          const list = $createListNode('bullet');
          const item = $createListItemNode();
          item.append($createTextNode('Hello'));
          list.append(item);
          $getRoot().append(list);
          item.selectEnd();
        },
        dependencies: [
          configExtension(TouchIndentationExtension, {swipeThreshold: 100}),
          ListExtension,
        ],
        name: 'test',
      }),
    );

    const indentHandler = vi.fn(() => true);
    editor.registerCommand(INDENT_CONTENT_COMMAND, indentHandler, 1);

    const root = editor.getRootElement();
    assert(root !== null);
    // 60px swipe — below custom threshold of 100
    simulateSwipe(root, 100, 200, 160, 200);
    expect(indentHandler).not.toHaveBeenCalled();

    // 120px swipe — above custom threshold of 100
    simulateSwipe(root, 100, 200, 220, 200);
    expect(indentHandler).toHaveBeenCalledTimes(1);
  });

  it('cleans up event listeners on dispose', () => {
    using editor = buildEditorFromExtensions(
      defineExtension({
        $initialEditorState: $initialEditorStateWithList,
        dependencies: [TouchIndentationExtension, ListExtension],
        name: 'test',
      }),
    );
    const indentHandler = vi.fn(() => true);

    editor.registerCommand(INDENT_CONTENT_COMMAND, indentHandler, 1);

    const root = editor.getRootElement();
    assert(root !== null);
    simulateSwipe(root, 100, 200, 200, 200);
    expect(indentHandler).not.toHaveBeenCalled();
  });
});
