var __FOCUS_NEXT_GROUP_GLOBAL__ = (function () {
  const PADDING = 4;
  const GAP = 6;
  const POSITION_PREFIX = "cn.marginnote.focus-next.group-position-";

  function positionKey(horizontal) { return POSITION_PREFIX + (horizontal ? "horizontal" : "vertical"); }

  function readPosition(horizontal) {
    try {
      const stored = NSUserDefaults.standardUserDefaults().objectForKey(positionKey(horizontal));
      if (stored === undefined || stored === null) return null;
      const result = JSON.parse(String(stored));
      if (result && typeof result.xRatio === "number" && Number.isFinite(result.xRatio) &&
        typeof result.yRatio === "number" && Number.isFinite(result.yRatio)) {
        return { xRatio: Math.max(0, Math.min(1, result.xRatio)), yRatio: Math.max(0, Math.min(1, result.yRatio)) };
      }
    } catch (ignored) {}
    return null;
  }

  function savePosition(group) {
    const parent = group && group.view.superview;
    if (!parent) return;
    const frame = group.view.frame, bounds = parent.bounds;
    const position = {
      xRatio: Math.max(0, Math.min(1, frame.x / Math.max(1, bounds.width - frame.width))),
      yRatio: Math.max(0, Math.min(1, frame.y / Math.max(1, bounds.height - frame.height))),
    };
    try { NSUserDefaults.standardUserDefaults().setObjectForKey(JSON.stringify(position), positionKey(group.horizontal)); }
    catch (error) { console.log(`[Focus Switch] 保存集中显示位置失败：${error && error.message || error}`); }
  }

  function finishDrag(addon) {
    const group = addon && addon.__focusNextGroup;
    if (!group || !group.dragging) return;
    savePosition(group);
    group.dragging = false;
    addon.__focusNextDragging = false;
    addon.__focusNextSuppressTap = true;
  }

  function create(addon) {
    const view = new UIView({ x: 0, y: 0, width: 0, height: 0 });
    view.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(0.12, 0.42, 0.78, 0.12);
    view.layer.cornerRadius = 16;
    view.layer.masksToBounds = true;
    view.addGestureRecognizer(new UIPanGestureRecognizer(addon, "handleFocusGroupPan:"));
    return { view, dragging: false, horizontal: false, entries: [] };
  }

  function frames(entries, bounds, horizontal) {
    let x = PADDING, y = PADDING, lineSize = 0, width = 0, height = 0;
    let line = [];
    function alignLine() {
      line.forEach(function (frame) { if (horizontal) frame.height = lineSize; else frame.width = lineSize; });
    }
    const result = entries.map(function (entry) {
      const itemWidth = Math.min(entry.width, Math.max(1, bounds.width - PADDING * 2));
      const itemHeight = Math.min(entry.height, Math.max(1, bounds.height - PADDING * 2));
      // 按所选方向流式排列，分屏空间不足时换行或换列，保留全部按钮。
      if (horizontal && x > PADDING && x + itemWidth + PADDING > bounds.width) {
        alignLine(); line = []; x = PADDING; y += lineSize + GAP; lineSize = 0;
      } else if (!horizontal && y > PADDING && y + itemHeight + PADDING > bounds.height) {
        alignLine(); line = []; y = PADDING; x += lineSize + GAP; lineSize = 0;
      }
      const frame = { x, y, width: itemWidth, height: itemHeight };
      line.push(frame);
      width = Math.max(width, x + itemWidth + PADDING);
      height = Math.max(height, y + itemHeight + PADDING);
      if (horizontal) { x += itemWidth + GAP; lineSize = Math.max(lineSize, itemHeight); }
      else { y += itemHeight + GAP; lineSize = Math.max(lineSize, itemWidth); }
      return frame;
    });
    alignLine();
    return { items: result, width, height };
  }

  function place(addon, parent, entries) {
    if (!addon || !parent) return false;
    if (!entries.length) {
      hide(addon);
      if (addon.__focusNextGroup) addon.__focusNextGroup.entries = [];
      return false;
    }
    const group = addon.__focusNextGroup || (addon.__focusNextGroup = create(addon));
    if (group.dragging) return true;
    const horizontal = __FOCUS_NEXT_CORE_GLOBAL__.horizontalLayout();
    const layout = frames(entries, parent.bounds, horizontal);
    const position = readPosition(horizontal);
    const availableWidth = Math.max(0, parent.bounds.width - layout.width);
    const availableHeight = Math.max(0, parent.bounds.height - layout.height);
    const x = position ? position.xRatio * availableWidth : horizontal ? availableWidth / 2 : availableWidth - 10;
    const y = position ? position.yRatio * availableHeight : horizontal ? availableHeight - 10 : availableHeight / 2;
    group.view.frame = { x: Math.max(0, Math.min(availableWidth, x)), y: Math.max(0, Math.min(availableHeight, y)), width: layout.width, height: layout.height };
    group.horizontal = horizontal;
    group.entries = entries;
    if (group.view.superview !== parent) {
      const menu = addon.__focusNextSettings;
      if (menu && menu.panel.superview === parent) parent.insertSubviewBelowSubview(group.view, menu.panel);
      else parent.addSubview(group.view);
    }
    entries.forEach(function (entry, index) {
      if (entry.button.superview !== group.view) group.view.addSubview(entry.button);
      entry.button.frame = layout.items[index];
    });
    return true;
  }

  function handlePan(addon, recognizer) {
    const group = addon && addon.__focusNextGroup;
    const parent = group && group.view.superview;
    if (!parent || !__FOCUS_NEXT_CORE_GLOBAL__.groupedDisplay() || addon.focusNextEnabled === false) return;
    const state = Number(recognizer.state);
    if (state === 1) {
      __FOCUS_NEXT_SOURCE_GLOBAL__.clear(addon);
      __FOCUS_NEXT_COMMENTS_GLOBAL__.clearPress(addon);
      group.dragging = true;
      addon.__focusNextDragging = true;
      addon.__focusNextPlaceToken = Number(addon.__focusNextPlaceToken || 0) + 1;
    } else if (state === 2 && group.dragging) {
      const delta = recognizer.translationInView(parent), frame = group.view.frame;
      const dx = Number(delta && delta.x), dy = Number(delta && delta.y);
      if (Number.isFinite(dx) && Number.isFinite(dy)) group.view.frame = {
        x: Math.max(0, Math.min(Math.max(0, parent.bounds.width - frame.width), frame.x + dx)),
        y: Math.max(0, Math.min(Math.max(0, parent.bounds.height - frame.height), frame.y + dy)),
        width: frame.width, height: frame.height,
      };
      recognizer.setTranslationInView({ x: 0, y: 0 }, parent);
    } else if (state === 3 || state === 4 || state === 5) finishDrag(addon);
  }

  function hide(addon) {
    finishDrag(addon);
    const group = addon && addon.__focusNextGroup;
    if (group && group.view.superview) group.view.removeFromSuperview();
  }

  function detach(addon, parent) {
    const group = addon && addon.__focusNextGroup;
    if (!group) return;
    finishDrag(addon);
    group.entries.forEach(function (entry) {
      if (entry.button.superview === group.view) parent.addSubview(entry.button);
    });
    hide(addon);
  }

  function remove(addon) { hide(addon); if (addon) addon.__focusNextGroup = null; }
  return { place, handlePan, finishDrag, hide, detach, remove };
})();
