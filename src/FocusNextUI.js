var __FOCUS_NEXT_UI_GLOBAL__ = (function () {
  const BUTTON_WIDTH = 76;
  const BUTTON_HEIGHT = 36;
  const ICON_BUTTON_SIZE = 36;
  const RIGHT_MARGIN = 10;
  const NEXT_POSITION_KEY = "cn.marginnote.focus-next.next-button-position";
  const PREVIOUS_POSITION_KEY = "cn.marginnote.focus-next.previous-button-position";
  const SOURCE_POSITION_KEY = "cn.marginnote.focus-next.source-button-position";
  const COLLAPSE_POSITION_KEY = "cn.marginnote.focus-next.collapse-comments-button-position";
  const EXPAND_POSITION_KEY = "cn.marginnote.focus-next.expand-comments-button-position";

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  function readSavedPosition(key) {
    try {
      const stored = NSUserDefaults.standardUserDefaults().objectForKey(key);
      if (stored === undefined || stored === null) return undefined;
      const text = String(stored);
      if (text.charAt(0) === "{") {
        try { return JSON.parse(text); } catch (ignored) {}
      }
      const parts = text.split(",");
      if (parts.length === 2 && Number.isFinite(Number(parts[0])) && Number.isFinite(Number(parts[1]))) {
        return { xRatio: Number(parts[0]), yRatio: Number(parts[1]) };
      }
      return stored;
    } catch (error) {
      console.log(`[Focus Switch] 读取按钮位置失败：${error && error.message || error}`);
      return undefined;
    }
  }

  function viewFor(addon) {
    const application = Application.sharedInstance();
    const focusWindow = application && application.focusWindow;
    const candidates = [addon && addon.window, focusWindow, undefined];
    for (const window of candidates) {
      try {
        const controller = window === undefined ? application.studyController() : application.studyController(window);
        if (controller && controller.view) return controller.view;
      } catch (ignored) {}
    }
    return undefined;
  }

  function buttonWidth(button, view) {
    const minimum = button && button.__focusNextIconMode ? ICON_BUTTON_SIZE : BUTTON_WIDTH;
    return Math.min(minimum, Math.max(0, Number(view && view.bounds && view.bounds.width) || minimum));
  }

  function buttonHeight(button) { return button && button.__focusNextIconMode ? ICON_BUTTON_SIZE : BUTTON_HEIGHT; }

  function placeButton(addon, button, positionKey, rightSide, verticalOffset, topOverride) {
    const view = viewFor(addon);
    if (!button || !view || !view.bounds) return false;
    const saved = readSavedPosition(positionKey);
    const width = buttonWidth(button, view);
    const availableWidth = Math.max(0, view.bounds.width - width);
    const height = buttonHeight(button);
    const availableHeight = Math.max(0, view.bounds.height - height);
    const savedXRatio = finiteNumber(saved && saved.xRatio);
    const savedYRatio = finiteNumber(saved && saved.yRatio);
    const legacyX = finiteNumber(saved && saved.x);
    const legacyY = finiteNumber(saved && saved.y);
    const savedViewWidth = finiteNumber(saved && saved.viewWidth);
    const savedViewHeight = finiteNumber(saved && saved.viewHeight);
    const legacyWidth = Math.max(1, (savedViewWidth || view.bounds.width) - BUTTON_WIDTH);
    const legacyHeight = Math.max(1, (savedViewHeight || view.bounds.height) - BUTTON_HEIGHT);
    const commentsVisible = addon && [addon.__focusCollapseCommentsButton, addon.__focusExpandCommentsButton].some(function (item) { return item && !item.hidden; });
    const defaultTop = topOverride !== undefined ? topOverride : rightSide && commentsVisible
      ? Math.max(0, Math.min(availableHeight / 2, availableHeight - (BUTTON_HEIGHT + 12) * 3)) : availableHeight / 2;
    const defaultY = Math.min(availableHeight, defaultTop + (verticalOffset || 0));
    const defaultX = rightSide ? Math.max(0, availableWidth - RIGHT_MARGIN) : RIGHT_MARGIN;
    const x = savedXRatio !== undefined ? savedXRatio * availableWidth : legacyX !== undefined ? (legacyX / legacyWidth) * availableWidth : defaultX;
    const y = savedYRatio !== undefined ? savedYRatio * availableHeight : legacyY !== undefined ? (legacyY / legacyHeight) * availableHeight : defaultY;
    button.frame = {
      x: Math.max(0, Math.min(availableWidth, x)),
      y: Math.max(0, Math.min(availableHeight, y)),
      width,
      height,
    };
    return true;
  }

  function place(addon) {
    const previous = addon && addon.__focusPreviousButton;
    const next = addon && addon.__focusNextButton;
    const source = addon && addon.__focusSourceButton;
    const view = viewFor(addon);
    if (!view || !view.bounds) return false;
    if (__FOCUS_NEXT_CORE_GLOBAL__.groupedDisplay()) {
      const buttons = [previous, next, source, addon.__focusCollapseCommentsButton, addon.__focusExpandCommentsButton]
        .filter(function (button) { return button && !button.hidden; });
      return __FOCUS_NEXT_GROUP_GLOBAL__.place(addon, view, buttons.map(function (button) {
        return { button, width: buttonWidth(button, view), height: buttonHeight(button) };
      }));
    }
    __FOCUS_NEXT_GROUP_GLOBAL__.detach(addon, view);
    const previousPlaced = placeButton(addon, previous, PREVIOUS_POSITION_KEY, false);
    if (__FOCUS_NEXT_CORE_GLOBAL__.iconDisplay()) {
      const rightButtons = [
        [next, NEXT_POSITION_KEY], [source, SOURCE_POSITION_KEY],
        [addon.__focusCollapseCommentsButton, COLLAPSE_POSITION_KEY], [addon.__focusExpandCommentsButton, EXPAND_POSITION_KEY],
      ].filter(function (entry) { return entry[0] && !entry[0].hidden; });
      const totalHeight = rightButtons.reduce(function (sum, entry) { return sum + buttonHeight(entry[0]); }, 0);
      const gap = rightButtons.length > 1 ? Math.max(0, Math.min(12, (view.bounds.height - totalHeight) / (rightButtons.length - 1))) : 0;
      const stackHeight = totalHeight + gap * Math.max(0, rightButtons.length - 1);
      const top = Math.max(0, Math.min((view.bounds.height - buttonHeight(next)) / 2, view.bounds.height - stackHeight));
      let offset = 0;
      rightButtons.forEach(function (entry) {
        placeButton(addon, entry[0], entry[1], true, offset, top);
        offset += buttonHeight(entry[0]) + gap;
      });
      return previousPlaced || rightButtons.length > 0;
    }
    const nextPlaced = placeButton(addon, next, NEXT_POSITION_KEY, true);
    const sourcePlaced = placeButton(addon, source, SOURCE_POSITION_KEY, true, BUTTON_HEIGHT + 12);
    const collapsePlaced = placeButton(addon, addon && addon.__focusCollapseCommentsButton, COLLAPSE_POSITION_KEY, true, (BUTTON_HEIGHT + 12) * 2);
    const expandPlaced = placeButton(addon, addon && addon.__focusExpandCommentsButton, EXPAND_POSITION_KEY, true, (BUTTON_HEIGHT + 12) * 3);
    return previousPlaced || nextPlaced || sourcePlaced || collapsePlaced || expandPlaced;
  }

  function savePosition(addon, button, positionKey) {
    if (!button || !button.frame) return;
    const view = viewFor(addon);
    if (!view || !view.bounds) return;
    const availableWidth = Math.max(1, view.bounds.width - buttonWidth(button, view));
    const availableHeight = Math.max(1, view.bounds.height - buttonHeight(button));
    const position = {
      xRatio: Math.max(0, Math.min(1, (Number(button.frame.x) || 0) / availableWidth)),
      yRatio: Math.max(0, Math.min(1, (Number(button.frame.y) || 0) / availableHeight)),
      viewWidth: Number(view.bounds.width) || 0,
      viewHeight: Number(view.bounds.height) || 0,
    };
    try { NSUserDefaults.standardUserDefaults().setObjectForKey(JSON.stringify(position), positionKey); } catch (error) {
      console.log(`[Focus Switch] 保存按钮位置失败：${error && error.message || error}`);
    }
  }

  function schedulePlace(addon) {
    if (!addon || typeof NSTimer === "undefined" || !NSTimer.scheduledTimerWithTimeInterval) return;
    const token = Number(addon.__focusNextPlaceToken || 0) + 1;
    addon.__focusNextPlaceToken = token;
    const delays = [0.08, 0.25, 0.6];
    function run(index) {
      if (!addon || addon.__focusNextPlaceToken !== token || addon.__focusNextDragging) return;
      place(addon);
      if (index < delays.length) NSTimer.scheduledTimerWithTimeInterval(delays[index], false, function () { run(index + 1); });
    }
    NSTimer.scheduledTimerWithTimeInterval(delays[0], false, function () { run(1); });
  }

  function handlePan(addon, recognizer, button, positionKey) {
    const view = viewFor(addon);
    if (!button || !view || !view.bounds) return;
    if (__FOCUS_NEXT_CORE_GLOBAL__.groupedDisplay()) { __FOCUS_NEXT_GROUP_GLOBAL__.handlePan(addon, recognizer); return; }
    const state = Number(recognizer.state);
    if (state === 1) {
      __FOCUS_NEXT_SOURCE_GLOBAL__.clear(addon);
      __FOCUS_NEXT_COMMENTS_GLOBAL__.clearPress(addon);
      addon.__focusNextDragging = true;
      addon.__focusNextIndependentDrag = { button, positionKey };
      addon.__focusNextPlaceToken = Number(addon.__focusNextPlaceToken || 0) + 1;
      return;
    }
    if (state === 2 && addon.__focusNextDragging && addon.__focusNextIndependentDrag && addon.__focusNextIndependentDrag.button === button) {
      const translation = recognizer.translationInView(view);
      const frame = button.frame;
      const width = buttonWidth(button, view);
      const height = buttonHeight(button);
      button.frame = {
        x: Math.max(0, Math.min(view.bounds.width - width, frame.x + Number(translation.x || 0))),
        y: Math.max(0, Math.min(view.bounds.height - height, frame.y + Number(translation.y || 0))),
        width,
        height,
      };
      recognizer.setTranslationInView({ x: 0, y: 0 }, view);
      return;
    }
    if ((state === 3 || state === 4 || state === 5) && addon.__focusNextIndependentDrag && addon.__focusNextIndependentDrag.button === button) finishDrag(addon);
  }

  function finishDrag(addon) {
    if (!addon) return;
    __FOCUS_NEXT_GROUP_GLOBAL__.finishDrag(addon);
    const drag = addon.__focusNextIndependentDrag;
    if (!drag) return;
    savePosition(addon, drag.button, drag.positionKey);
    addon.__focusNextIndependentDrag = null;
    addon.__focusNextDragging = false;
    addon.__focusNextSuppressTap = true;
  }

  function rememberLoop(addon, token) {
    const next = addon && addon.__focusNextButton;
    const previous = addon && addon.__focusPreviousButton;
    const source = addon && addon.__focusSourceButton;
    if (!addon || addon.__focusNextRememberToken !== token ||
      ![next, previous, source, addon.__focusCollapseCommentsButton, addon.__focusExpandCommentsButton].some(function (button) { return button && !button.hidden; })) return;
    if (addon.focusNextEnabled !== false) __FOCUS_NEXT_CORE_GLOBAL__.rememberFocus(addon);
    const view = viewFor(addon);
    const bounds = view && view.bounds;
    const size = bounds && `${bounds.width},${bounds.height}`;
    if (size && addon.__focusNextViewSize !== size && !addon.__focusNextDragging) {
      addon.__focusNextViewSize = size;
      place(addon);
    }
    if (typeof NSTimer !== "undefined" && NSTimer.scheduledTimerWithTimeInterval) NSTimer.scheduledTimerWithTimeInterval(0.15, false, function () { rememberLoop(addon, token); });
  }

  function startRemembering(addon) {
    if (!addon) return;
    const token = Number(addon.__focusNextRememberToken || 0) + 1;
    addon.__focusNextRememberToken = token;
    if (addon.focusNextEnabled !== false) __FOCUS_NEXT_CORE_GLOBAL__.rememberFocus(addon);
    if (typeof NSTimer === "undefined" || !NSTimer.scheduledTimerWithTimeInterval) return;
    NSTimer.scheduledTimerWithTimeInterval(0.15, false, function () { rememberLoop(addon, token); });
  }

  function show(addon) {
    if (!addon) return false;
    if (addon.focusNextEnabled === false) { hide(addon); return false; }
    const view = viewFor(addon);
    if (!view) return false;
    const buttonDefinitions = [
      { property: "__focusPreviousButton", title: "上一张", icon: "arrow-up", action: "focusPrevious:", panAction: "handleFocusPreviousButtonPan:", visible: addon.focusNextEnabled !== false && __FOCUS_NEXT_CORE_GLOBAL__.previousEnabled() },
      { property: "__focusNextButton", title: "下一张", icon: "arrow-down", action: "focusNext:", panAction: "handleFocusNextButtonPan:", visible: addon.focusNextEnabled !== false },
      { property: "__focusSourceButton", title: "查看原题", icon: "zoom-scan", action: "openOriginal:", pressAction: "pressOriginal:", panAction: "handleFocusSourceButtonPan:", visible: addon.focusNextEnabled !== false && __FOCUS_NEXT_CORE_GLOBAL__.sourceEnabled() },
      { property: "__focusCollapseCommentsButton", title: "折叠评论", icon: "fold-vertical", action: "collapseComments:", pressAction: "pressComments:", panAction: "handleFocusCollapseCommentsPan:", visible: addon.focusNextEnabled !== false && __FOCUS_NEXT_CORE_GLOBAL__.collapseCommentsEnabled() },
      { property: "__focusExpandCommentsButton", title: "展开评论", icon: "unfold-vertical", action: "expandComments:", pressAction: "pressComments:", panAction: "handleFocusExpandCommentsPan:", visible: addon.focusNextEnabled !== false && __FOCUS_NEXT_CORE_GLOBAL__.expandCommentsEnabled() },
    ];
    for (const definition of buttonDefinitions) {
      let button = addon[definition.property];
      if (definition.visible === false) {
        if (button) {
          button.hidden = true;
          if (button.superview) button.removeFromSuperview();
        }
        continue;
      }
      if (!button) {
        button = new UIButton({ x: 0, y: 0, width: BUTTON_WIDTH, height: BUTTON_HEIGHT });
        button.setTitleForState(definition.title, 0);
        button.setTitleColorForState(UIColor.whiteColor(), 0);
        button.titleLabel.font = UIFont.boldSystemFontOfSize(14);
        button.titleLabel.numberOfLines = 1;
        button.titleLabel.lineBreakMode = 4;
        button.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(0.12, 0.42, 0.78, 0.94);
        button.layer.cornerRadius = 8;
        button.layer.masksToBounds = true;
        button.addTargetActionForControlEvents(addon, definition.action, 1 << 6);
        if (definition.pressAction) button.addTargetActionForControlEvents(addon, definition.pressAction, 1 << 0);
        button.addGestureRecognizer(new UIPanGestureRecognizer(addon, definition.panAction));
        addon[definition.property] = button;
      }
      const image = __FOCUS_NEXT_CORE_GLOBAL__.iconDisplay() && typeof button.setImageForState === "function"
        ? __FOCUS_NEXT_ICONS_GLOBAL__.image(addon, definition.icon) : null;
      if (image || button.__focusNextIconMode) button.setImageForState(image || null, 0);
      button.__focusNextIconMode = Boolean(image);
      button.layer.cornerRadius = image ? 9 : 8;
      button.setTitleForState(image ? "" : definition.title, 0);
      if (button.superview !== view) {
        if (button.superview) button.removeFromSuperview();
        view.addSubview(button);
      }
      button.hidden = false;
    }
    place(addon);
    schedulePlace(addon);
    startRemembering(addon);
    return true;
  }

  function hide(addon) {
    finishDrag(addon);
    __FOCUS_NEXT_GROUP_GLOBAL__.hide(addon);
    if (addon) {
      addon.__focusNextRememberToken = Number(addon.__focusNextRememberToken || 0) + 1;
      addon.__focusNextPlaceToken = Number(addon.__focusNextPlaceToken || 0) + 1;
    }
    const buttons = [addon && addon.__focusPreviousButton, addon && addon.__focusNextButton, addon && addon.__focusSourceButton,
      addon && addon.__focusCollapseCommentsButton, addon && addon.__focusExpandCommentsButton];
    __FOCUS_NEXT_SOURCE_GLOBAL__.clear(addon);
    __FOCUS_NEXT_COMMENTS_GLOBAL__.cancel(addon);
    for (const button of buttons) {
      if (!button) continue;
      button.hidden = true;
      if (button.superview) button.removeFromSuperview();
    }
  }

  function remove(addon) {
    hide(addon);
    __FOCUS_NEXT_GROUP_GLOBAL__.remove(addon);
    if (addon) {
      addon.__focusPreviousButton = null;
      addon.__focusNextButton = null;
      addon.__focusSourceButton = null;
      addon.__focusCollapseCommentsButton = null;
      addon.__focusExpandCommentsButton = null;
    }
  }

  function handleNextPan(addon, recognizer) {
    handlePan(addon, recognizer, addon && addon.__focusNextButton, NEXT_POSITION_KEY);
  }

  function handlePreviousPan(addon, recognizer) {
    handlePan(addon, recognizer, addon && addon.__focusPreviousButton, PREVIOUS_POSITION_KEY);
  }
  function handleSourcePan(addon, recognizer) {
    handlePan(addon, recognizer, addon && addon.__focusSourceButton, SOURCE_POSITION_KEY);
  }
  function handleCollapseCommentsPan(addon, recognizer) {
    handlePan(addon, recognizer, addon && addon.__focusCollapseCommentsButton, COLLAPSE_POSITION_KEY);
  }
  function handleExpandCommentsPan(addon, recognizer) {
    handlePan(addon, recognizer, addon && addon.__focusExpandCommentsButton, EXPAND_POSITION_KEY);
  }

  return { show, hide, remove, place, finishDrag, handleNextPan, handlePreviousPan, handleSourcePan,
    handleCollapseCommentsPan, handleExpandCommentsPan };
})();
