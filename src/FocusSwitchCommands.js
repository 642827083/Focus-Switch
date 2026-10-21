var __FOCUS_NEXT_COMMANDS_GLOBAL__ = (function () {
  const DOUBLE_CLICK_SECONDS = 0.3;

  function refreshToolbar(addon) {
    try {
      const application = Application.sharedInstance();
      const controller = application && typeof application.studyController === "function" ? application.studyController(addon.window) : undefined;
      if (controller && typeof controller.refreshAddonCommands === "function") controller.refreshAddonCommands();
    } catch (error) { console.log(`[Focus Switch] 刷新插件图标失败：${error && error.message || error}`); }
  }

  function apply(addon, key, value) {
    const core = __FOCUS_NEXT_CORE_GLOBAL__;
    __FOCUS_NEXT_UI_GLOBAL__.finishDrag(addon);
    if (key === "enabled") {
      addon.focusNextEnabled = core.setEnabled(value);
      if (!addon.focusNextEnabled) {
        addon.__focusNextLastFocus = null;
        addon.__focusNextLastNotebookId = null;
      }
    }
    else if (key === "crossLevel") core.setCrossLevelEnabled(value);
    else if (key === "next") core.setNextEnabled(value);
    else if (key === "previous") core.setPreviousEnabled(value);
    else if (key === "iconDisplay") core.setIconDisplay(value);
    else if (key === "groupedDisplay" || key === "horizontalLayout") {
      if (key === "groupedDisplay") core.setGroupedDisplay(value);
      else core.setHorizontalLayout(value);
      __FOCUS_NEXT_SOURCE_GLOBAL__.clear(addon);
      __FOCUS_NEXT_COMMENTS_GLOBAL__.clearPress(addon);
    }
    else if (key === "source") { core.setSourceEnabled(value); __FOCUS_NEXT_SOURCE_GLOBAL__.clear(addon); }
    else if (key === "collapseComments" || key === "expandComments") {
      if (key === "collapseComments") core.setCollapseCommentsEnabled(value);
      else core.setExpandCommentsEnabled(value);
      __FOCUS_NEXT_COMMENTS_GLOBAL__.clearPress(addon);
      const request = addon.__focusNextCommentsRequest;
      if (!value && request && request.collapsed === (key === "collapseComments")) __FOCUS_NEXT_COMMENTS_GLOBAL__.cancel(addon);
    }
    else throw new Error("未知的焦点切换设置");
    __FOCUS_NEXT_UI_GLOBAL__.show(addon);
    __FOCUS_NEXT_SETTINGS_GLOBAL__.refresh(addon);
    refreshToolbar(addon);
  }

  function cancelClick(addon) {
    if (!addon) return;
    addon.__focusNextClickToken = Number(addon.__focusNextClickToken || 0) + 1;
    addon.__focusNextClickPending = false;
    const timer = addon.__focusNextClickTimer;
    addon.__focusNextClickTimer = null;
    if (timer && typeof timer.invalidate === "function") timer.invalidate();
  }

  function toolbarClick(addon) {
    const now = Date.now();
    if (addon.__focusNextClickPending) {
      const elapsed = now - Number(addon.__focusNextClickAt);
      if (elapsed >= 0 && elapsed <= DOUBLE_CLICK_SECONDS * 1000) {
        cancelClick(addon);
        __FOCUS_NEXT_SETTINGS_GLOBAL__.hide(addon);
        apply(addon, "enabled", !coreEnabled());
        return;
      }
      cancelClick(addon);
      __FOCUS_NEXT_SETTINGS_GLOBAL__.toggle(addon);
    }
    if (typeof NSTimer === "undefined" || typeof NSTimer.scheduledTimerWithTimeInterval !== "function") {
      __FOCUS_NEXT_SETTINGS_GLOBAL__.toggle(addon);
      return;
    }
    addon.__focusNextClickPending = true;
    addon.__focusNextClickAt = now;
    const token = Number(addon.__focusNextClickToken || 0) + 1;
    addon.__focusNextClickToken = token;
    // 等待双击窗口结束，避免双击时先弹出菜单。
    addon.__focusNextClickTimer = NSTimer.scheduledTimerWithTimeInterval(DOUBLE_CLICK_SECONDS, false, function () {
      if (addon.__focusNextClickToken !== token || !addon.__focusNextClickPending) return;
      addon.__focusNextClickPending = false;
      addon.__focusNextClickTimer = null;
      __FOCUS_NEXT_SETTINGS_GLOBAL__.toggle(addon);
    });
  }

  function coreEnabled() { return __FOCUS_NEXT_CORE_GLOBAL__.enabled(); }
  return { apply, toolbarClick, cancelClick, refreshToolbar };
})();
