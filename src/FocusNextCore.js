var __FOCUS_NEXT_CORE_GLOBAL__ = (function () {
  const ENABLED_KEY = "cn.marginnote.focus-next.enabled";
  const NEXT_ENABLED_KEY = "cn.marginnote.focus-next.next-enabled";
  const PREVIOUS_ENABLED_KEY = "cn.marginnote.focus-next.previous-enabled";
  const CROSS_LEVEL_ENABLED_KEY = "cn.marginnote.focus-next.cross-level-enabled";
  const AI_ENABLED_KEY = "cn.marginnote.focus-next.ai-enabled";
  const SOURCE_ENABLED_KEY = "cn.marginnote.focus-next.source-enabled";
  const COLLAPSE_COMMENTS_ENABLED_KEY = "cn.marginnote.focus-next.collapse-comments-enabled";
  const EXPAND_COMMENTS_ENABLED_KEY = "cn.marginnote.focus-next.expand-comments-enabled";
  const ICON_DISPLAY_KEY = "cn.marginnote.focus-next.icon-display";
  const GROUPED_DISPLAY_KEY = "cn.marginnote.focus-next.grouped-display";
  const HORIZONTAL_LAYOUT_KEY = "cn.marginnote.focus-next.group-horizontal";

  function member(object, key) {
    if (!object) return undefined;
    let value;
    try { value = object[key]; } catch (ignored) { value = undefined; }
    if (value === undefined && typeof object.objectForKey === "function") {
      try { value = object.objectForKey(key); } catch (ignored) {}
    }
    if (value === undefined && typeof object.valueForKey === "function") {
      try { value = object.valueForKey(key); } catch (ignored) {}
    }
    if (typeof value === "function") {
      try { value = value.call(object); } catch (ignored) { return undefined; }
    }
    return value;
  }

  function pathMember(object, path) {
    if (!object || !path) return undefined;
    let value;
    try {
      if (typeof object.valueForKeyPath === "function") value = object.valueForKeyPath(path);
    } catch (ignored) {}
    if (value !== undefined && value !== null) return value;
    const parts = String(path).split(".");
    value = object;
    for (const part of parts) {
      value = member(value, part);
      if (value === undefined || value === null) return undefined;
    }
    return value;
  }

  function items(list) {
    if (!list) return [];
    let count;
    try { count = typeof list.count === "function" ? list.count() : list.count !== undefined ? list.count : list.length; } catch (ignored) { return []; }
    count = Number(count);
    if (!Number.isFinite(count) || count < 1) return [];
    const result = [];
    for (let index = 0; index < count; index += 1) {
      try { result.push(typeof list.objectAtIndex === "function" ? list.objectAtIndex(index) : list[index]); } catch (ignored) {}
    }
    return result.filter(function (value) { return value !== undefined && value !== null; });
  }

  function studyController(addon) {
    const application = Application.sharedInstance();
    if (!application || typeof application.studyController !== "function") return undefined;
    const focusWindow = member(application, "focusWindow");
    const candidates = [addon && addon.window, focusWindow, undefined];
    for (const window of candidates) {
      try {
        const controller = window === undefined ? application.studyController() : application.studyController(window);
        if (controller) return controller;
      } catch (ignored) {}
    }
    return undefined;
  }

  function noteId(note) {
    return String(member(note, "noteId") || member(note, "noteid") || member(note, "id") || "");
  }

  function asNote(value) {
    if (!value) return undefined;
    const candidates = [member(value, "note"), member(value, "node"), member(value, "mindMapNode"), member(value, "mindmapNode"), member(value, "view"), value];
    for (const candidate of candidates) {
      if (!candidate) continue;
      if (noteId(candidate) || member(candidate, "noteTitle") !== undefined) return candidate;
      const nested = member(candidate, "note");
      if (nested && (noteId(nested) || member(nested, "noteTitle") !== undefined)) return nested;
    }
    return undefined;
  }

  function focusCandidates(addon) {
    const controller = studyController(addon);
    const notebook = member(controller, "notebookController");
    const mindmap = member(notebook, "mindmapView");
    const owners = [notebook, controller, mindmap];
    const keys = ["focusNote", "visibleFocusNote", "focusedNote", "currentFocusNote", "currentNote", "activeNote", "focusNode", "focusedNode", "focusMindMapNode", "currentMindMapNode", "focusView", "focusedView", "selectedView"];
    const result = [];
    for (const owner of owners) {
      for (const key of keys) {
        const note = asNote(member(owner, key));
        if (!note || !noteId(note)) continue;
        if (!result.some(function (item) { return noteId(item.note) === noteId(note); })) result.push({ note, source: key });
      }
    }
    const paths = [
      "notebookController.focusNote",
      "notebookController.visibleFocusNote",
      "notebookController.focusedNote",
      "notebookController.currentFocusNote",
      "notebookController.mindmapView.focusNote",
      "notebookController.mindmapView.focusNode",
      "notebookController.mindmapView.focusView",
    ];
    for (const path of paths) {
      const note = asNote(pathMember(controller, path));
      if (note && noteId(note) && !result.some(function (item) { return noteId(item.note) === noteId(note); })) result.push({ note, source: path });
    }
    return result;
  }

  function currentFocus(addon) {
    const candidates = focusCandidates(addon);
    return candidates.length ? candidates[0].note : undefined;
  }

  function rememberFocus(addon) {
    const candidates = focusCandidates(addon);
    const visible = candidates.find(function (candidate) {
      return candidate.source === "visibleFocusNote" || candidate.source === "notebookController.visibleFocusNote";
    });
    let note = visible ? visible.note : candidates.length ? candidates[0].note : undefined;
    const previousId = noteId(addon && addon.__focusNextLastFocus);
    // 可见焦点是明确入口，不因重复读取而在滞后的 focusNote 之间来回切换。
    if (!visible && previousId && candidates.length && noteId(note) === previousId) {
      for (let index = 1; index < candidates.length; index += 1) {
        if (noteId(candidates[index].note) !== previousId) {
          note = candidates[index].note;
          break;
        }
      }
    }
    if (note && addon) {
      addon.__focusNextLastFocus = note;
      addon.__focusNextLastNotebookId = String(member(member(studyController(addon), "notebookController"), "notebookId") || "");
    }
    return note;
  }

  function rememberedFocus(addon) {
    const notebookId = String(member(member(studyController(addon), "notebookController"), "notebookId") || "");
    if (!addon || addon.__focusNextLastNotebookId === undefined || addon.__focusNextLastNotebookId === null) return undefined;
    // 有学习集 ID 时核对归属；宿主未返回 ID 时，由学习集打开／关闭回调清除记忆。
    if (notebookId && addon.__focusNextLastNotebookId && addon.__focusNextLastNotebookId !== notebookId) return undefined;
    return addon.__focusNextLastFocus;
  }

  function navigationFocus(addon) {
    return rememberFocus(addon) || rememberedFocus(addon);
  }

  function navigationNote(addon) {
    const live = navigationFocus(addon);
    // 保留既有调用者直接提供导航起点的兼容入口。
    const remembered = addon && addon.__focusNextLastNotebookId === undefined && addon.__focusNextLastFocus;
    if (live || remembered) return live || remembered;
    throw new Error("请先双击进入一张脑图卡片焦点");
  }

  function adjacent(note, offset) {
    const parent = member(note, "parentNote");
    const siblings = items(member(parent, "childNotes"));
    if (!parent || !siblings.length) throw new Error("当前卡片没有同级兄弟卡片");
    const id = noteId(note);
    let index = -1;
    for (let cursor = 0; cursor < siblings.length; cursor += 1) {
      if (siblings[cursor] === note || (id && noteId(siblings[cursor]) === id)) { index = cursor; break; }
    }
    if (index < 0) throw new Error("当前焦点不在脑图同级卡片列表中");
    const targetIndex = index + offset;
    if (targetIndex < 0) throw new Error("已经是第一张同级卡片");
    if (targetIndex >= siblings.length) throw new Error("已经是最后一张同级卡片");
    return siblings[targetIndex];
  }

  function siblingIndex(note, siblings) {
    const id = noteId(note);
    for (let index = 0; index < siblings.length; index += 1) {
      if (siblings[index] === note || (id && noteId(siblings[index]) === id)) return index;
    }
    return -1;
  }

  function visit(note, visited) {
    const id = noteId(note);
    if (visited.some(function (entry) { return entry === note || (id && noteId(entry) === id); })) {
      throw new Error("脑图层级存在循环，无法继续切换");
    }
    visited.push(note);
  }

  function depthFirstNext(note) {
    const children = items(member(note, "childNotes"));
    if (children.length) {
      if (children[0] === note || (noteId(note) && noteId(children[0]) === noteId(note))) throw new Error("脑图层级存在循环，无法继续切换");
      return children[0];
    }
    let cursor = note;
    const visited = [];
    while (cursor) {
      visit(cursor, visited);
      const parent = member(cursor, "parentNote");
      if (!parent) break;
      const siblings = items(member(parent, "childNotes"));
      const index = siblingIndex(cursor, siblings);
      if (index < 0) throw new Error("当前焦点不在脑图父节点的子卡片列表中");
      if (index + 1 < siblings.length) return siblings[index + 1];
      cursor = parent;
    }
    throw new Error("已经是整棵脑图的最后一张卡片");
  }

  function depthFirstPrevious(note) {
    const parent = member(note, "parentNote");
    if (!parent) throw new Error("已经是整棵脑图的第一张卡片");
    const siblings = items(member(parent, "childNotes"));
    const index = siblingIndex(note, siblings);
    if (index < 0) throw new Error("当前焦点不在脑图父节点的子卡片列表中");
    if (index === 0) {
      if (parent === note || (noteId(note) && noteId(parent) === noteId(note))) throw new Error("脑图层级存在循环，无法继续切换");
      return parent;
    }
    let cursor = siblings[index - 1];
    const visited = [];
    while (cursor) {
      visit(cursor, visited);
      const children = items(member(cursor, "childNotes"));
      if (!children.length) return cursor;
      cursor = children[children.length - 1];
    }
  }

  function focusSibling(addon, offset) {
    const current = navigationNote(addon);
    const controller = studyController(addon);
    const notebook = member(controller, "notebookController");
    if (!notebook || typeof notebook.changeFocusToNote !== "function") throw new Error("当前 MarginNote 版本不支持切换脑图焦点");
    const target = crossLevelEnabled()
      ? (offset > 0 ? depthFirstNext(current) : depthFirstPrevious(current))
      : adjacent(current, offset);
    notebook.changeFocusToNote(target);
    if (typeof controller.focusNoteInMindMapById === "function") controller.focusNoteInMindMapById(noteId(target));
    if (addon) {
      addon.__focusNextLastFocus = target;
      addon.__focusNextLastNotebookId = String(member(notebook, "notebookId") || "");
    }
    return { current, next: target, nextId: noteId(target) };
  }

  function focusNext(addon) {
    return focusSibling(addon, 1);
  }

  function focusPrevious(addon) {
    return focusSibling(addon, -1);
  }

  function showMessage(addon, message) {
    try {
      const application = Application.sharedInstance();
      if (application && typeof application.showHUD === "function") application.showHUD(String(message), addon && addon.window, 2);
    } catch (error) { console.log(`[Focus Switch] 显示提示失败：${error && error.message || error}`); }
  }

  function readBoolean(key, fallback) {
    try {
      const value = NSUserDefaults.standardUserDefaults().objectForKey(key);
      if (value === undefined || value === null) return fallback;
      if (typeof value.booleanValue === "function") return Boolean(value.booleanValue());
      return !(value === false || value === 0 || String(value).toLowerCase() === "false");
    } catch (error) { return fallback; }
  }

  function writeBoolean(key, value) {
    const result = Boolean(value);
    try { NSUserDefaults.standardUserDefaults().setObjectForKey(result, key); } catch (ignored) {}
    return result;
  }

  function enabled() { return readBoolean(ENABLED_KEY, true); }
  function setEnabled(value) { return writeBoolean(ENABLED_KEY, value); }
  function nextEnabled() { return readBoolean(NEXT_ENABLED_KEY, true); }
  function setNextEnabled(value) { return writeBoolean(NEXT_ENABLED_KEY, value); }
  function previousEnabled() { return readBoolean(PREVIOUS_ENABLED_KEY, true); }
  function setPreviousEnabled(value) { return writeBoolean(PREVIOUS_ENABLED_KEY, value); }
  function crossLevelEnabled() { return readBoolean(CROSS_LEVEL_ENABLED_KEY, false); }
  function setCrossLevelEnabled(value) { return writeBoolean(CROSS_LEVEL_ENABLED_KEY, value); }
  function aiEnabled() { return readBoolean(AI_ENABLED_KEY, false); }
  function setAiEnabled(value) { return writeBoolean(AI_ENABLED_KEY, value); }
  function sourceEnabled() { return readBoolean(SOURCE_ENABLED_KEY, false); }
  function setSourceEnabled(value) { return writeBoolean(SOURCE_ENABLED_KEY, value); }
  function collapseCommentsEnabled() { return readBoolean(COLLAPSE_COMMENTS_ENABLED_KEY, true); }
  function setCollapseCommentsEnabled(value) { return writeBoolean(COLLAPSE_COMMENTS_ENABLED_KEY, value); }
  function expandCommentsEnabled() { return readBoolean(EXPAND_COMMENTS_ENABLED_KEY, true); }
  function setExpandCommentsEnabled(value) { return writeBoolean(EXPAND_COMMENTS_ENABLED_KEY, value); }
  function iconDisplay() { return readBoolean(ICON_DISPLAY_KEY, false); }
  function setIconDisplay(value) { return writeBoolean(ICON_DISPLAY_KEY, value); }
  function groupedDisplay() { return readBoolean(GROUPED_DISPLAY_KEY, false); }
  function setGroupedDisplay(value) { return writeBoolean(GROUPED_DISPLAY_KEY, value); }
  function horizontalLayout() { return readBoolean(HORIZONTAL_LAYOUT_KEY, false); }
  function setHorizontalLayout(value) { return writeBoolean(HORIZONTAL_LAYOUT_KEY, value); }

  return { currentFocus, rememberFocus, rememberedFocus, navigationFocus, noteId, focusNext, focusPrevious, showMessage,
    enabled, setEnabled, nextEnabled, setNextEnabled, previousEnabled, setPreviousEnabled,
    crossLevelEnabled, setCrossLevelEnabled, sourceEnabled, setSourceEnabled, aiEnabled, setAiEnabled,
    collapseCommentsEnabled, setCollapseCommentsEnabled, expandCommentsEnabled, setExpandCommentsEnabled,
    iconDisplay, setIconDisplay, groupedDisplay, setGroupedDisplay, horizontalLayout, setHorizontalLayout };
})();
