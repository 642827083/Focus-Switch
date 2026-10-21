function createFocusNextAddon(mainPath) {
  return JSB.defineClass("FocusNextAddon : JSExtension", {
    sceneWillConnect: function () {
      self.__focusNextMainPath = mainPath;
      self.focusNextEnabled = __FOCUS_NEXT_CORE_GLOBAL__.enabled();
      self.__focusNextRememberToken = 0;
      self.__focusNextPlaceToken = 0;
      self.__focusNextClickToken = 0;
      __FOCUS_NEXT_SOURCE_GLOBAL__.clear(self);
      console.log("[Focus Switch] 插件已初始化");
    },

    sceneDidDisconnect: function () {
      self.__focusNextRememberToken += 1;
      self.__focusNextPlaceToken += 1;
      __FOCUS_NEXT_COMMANDS_GLOBAL__.cancelClick(self);
      __FOCUS_NEXT_SETTINGS_GLOBAL__.remove(self);
      __FOCUS_NEXT_UI_GLOBAL__.remove(self);
      self.__focusNextLastFocus = null;
      self.__focusNextLastNotebookId = null;
      self.focusNextEnabled = false;
    },

    notebookWillOpen: function () {
      __FOCUS_NEXT_COMMENTS_GLOBAL__.cancel(self);
      __FOCUS_NEXT_COMMANDS_GLOBAL__.cancelClick(self);
      __FOCUS_NEXT_SETTINGS_GLOBAL__.hide(self);
      self.__focusNextLastFocus = null;
      self.__focusNextLastNotebookId = null;
      __FOCUS_NEXT_SOURCE_GLOBAL__.clear(self);
      __FOCUS_NEXT_UI_GLOBAL__.show(self);
    },

    queryAddonCommandStatus: function () {
      return { image: "icon.png", object: self, selector: "focusToolbarClick:", checked: self.focusNextEnabled !== false };
    },

    focusToolbarClick: function () {
      try { __FOCUS_NEXT_COMMANDS_GLOBAL__.toolbarClick(self); }
      catch (error) {
        __FOCUS_NEXT_CORE_GLOBAL__.showMessage(self, "暂时无法显示焦点切换菜单");
        console.log(`[Focus Switch] 菜单操作失败：${error && error.message || error}`);
      }
    },

    closeFocusSettings: function () { __FOCUS_NEXT_SETTINGS_GLOBAL__.hide(self); },
    toggleSettingsSwitchRow: function (sender) { __FOCUS_NEXT_SETTINGS_GLOBAL__.toggleSwitchRow(self, sender); },
    toggleAppearanceSection: function () { __FOCUS_NEXT_SETTINGS_GLOBAL__.toggleSection(self, "appearance"); },
    toggleNavigationSection: function () { __FOCUS_NEXT_SETTINGS_GLOBAL__.toggleSection(self, "navigation"); },
    toggleButtonsSection: function () { __FOCUS_NEXT_SETTINGS_GLOBAL__.toggleSection(self, "buttons"); },

    handleFocusSettingsPan: function (recognizer) { __FOCUS_NEXT_SETTINGS_GLOBAL__.handlePan(self, recognizer); },

    setFocusEnabled: function (sender) { __FOCUS_NEXT_COMMANDS_GLOBAL__.apply(self, "enabled", Boolean(sender.on)); },
    setCrossLevelEnabled: function (sender) { __FOCUS_NEXT_COMMANDS_GLOBAL__.apply(self, "crossLevel", Boolean(sender.on)); },
    setNavigationScope: function (sender) {
      const index = Number(sender.selectedSegmentIndex);
      if (index === 0 || index === 1) __FOCUS_NEXT_COMMANDS_GLOBAL__.apply(self, "crossLevel", index === 1);
    },
    setPreviousEnabled: function (sender) { __FOCUS_NEXT_COMMANDS_GLOBAL__.apply(self, "previous", Boolean(sender.on)); },
    setNextEnabled: function (sender) { __FOCUS_NEXT_COMMANDS_GLOBAL__.apply(self, "next", Boolean(sender.on)); },
    setSourceEnabled: function (sender) { __FOCUS_NEXT_COMMANDS_GLOBAL__.apply(self, "source", Boolean(sender.on)); },
    setCollapseCommentsEnabled: function (sender) { __FOCUS_NEXT_COMMANDS_GLOBAL__.apply(self, "collapseComments", Boolean(sender.on)); },
    setExpandCommentsEnabled: function (sender) { __FOCUS_NEXT_COMMANDS_GLOBAL__.apply(self, "expandComments", Boolean(sender.on)); },
    setIconDisplay: function (sender) { __FOCUS_NEXT_COMMANDS_GLOBAL__.apply(self, "iconDisplay", Boolean(sender.on)); },
    setButtonStyle: function (sender) {
      const index = Number(sender.selectedSegmentIndex);
      if (index === 0 || index === 1) __FOCUS_NEXT_COMMANDS_GLOBAL__.apply(self, "iconDisplay", index === 1);
    },
    setGroupedDisplay: function (sender) { __FOCUS_NEXT_COMMANDS_GLOBAL__.apply(self, "groupedDisplay", Boolean(sender.on)); },
    setButtonLayout: function (sender) {
      const index = Number(sender.selectedSegmentIndex);
      if (index === 0 || index === 1) __FOCUS_NEXT_COMMANDS_GLOBAL__.apply(self, "groupedDisplay", index === 1);
    },
    setGroupDirection: function (sender) {
      const index = Number(sender.selectedSegmentIndex);
      if (index === 0 || index === 1) __FOCUS_NEXT_COMMANDS_GLOBAL__.apply(self, "horizontalLayout", index === 1);
    },
    handleFocusGroupPan: function (recognizer) { __FOCUS_NEXT_GROUP_GLOBAL__.handlePan(self, recognizer); },

    pressOriginal: function () { __FOCUS_NEXT_SOURCE_GLOBAL__.press(self); },
    pressComments: function () { __FOCUS_NEXT_COMMENTS_GLOBAL__.press(self); },
    collapseComments: function () { __FOCUS_NEXT_COMMENTS_GLOBAL__.perform(self, true); },
    expandComments: function () { __FOCUS_NEXT_COMMENTS_GLOBAL__.perform(self, false); },
    openOriginal: function () {
      if (self.__focusNextSuppressTap) {
        self.__focusNextSuppressTap = false;
        __FOCUS_NEXT_SOURCE_GLOBAL__.clear(self);
        return;
      }
      if (!self.__focusSourceButton || self.__focusSourceButton.hidden) return;
      try { __FOCUS_NEXT_SOURCE_GLOBAL__.open(self); }
      catch (error) {
        __FOCUS_NEXT_CORE_GLOBAL__.showMessage(self, String(error && error.message || error));
        console.log(`[Focus Switch] 查看原题失败：${error && error.message || error}`);
      }
    },

    sceneWillResignActive: function () {
      __FOCUS_NEXT_UI_GLOBAL__.finishDrag(self);
      __FOCUS_NEXT_COMMENTS_GLOBAL__.cancel(self);
      __FOCUS_NEXT_SOURCE_GLOBAL__.clear(self);
      __FOCUS_NEXT_COMMANDS_GLOBAL__.cancelClick(self);
      __FOCUS_NEXT_SETTINGS_GLOBAL__.hide(self);
    },

    notebookWillClose: function () {
      __FOCUS_NEXT_COMMANDS_GLOBAL__.cancelClick(self);
      __FOCUS_NEXT_SETTINGS_GLOBAL__.hide(self);
      __FOCUS_NEXT_UI_GLOBAL__.hide(self);
      self.__focusNextLastFocus = null;
      self.__focusNextLastNotebookId = null;
    },

    controllerWillLayoutSubviews: function () {
      __FOCUS_NEXT_SETTINGS_GLOBAL__.layout(self);
      if (!self.__focusNextDragging) __FOCUS_NEXT_UI_GLOBAL__.place(self);
    },

    toggleFocusNext: function () {
      __FOCUS_NEXT_COMMANDS_GLOBAL__.apply(self, "enabled", !(self.focusNextEnabled !== false));
    },

    focusNext: function () {
      if (self.__focusNextSuppressTap) {
        self.__focusNextSuppressTap = false;
        return;
      }
      if (self.focusNextEnabled === false || !__FOCUS_NEXT_CORE_GLOBAL__.nextEnabled()) return;
      try {
        __FOCUS_NEXT_CORE_GLOBAL__.focusNext(self);
      }
      catch (error) {
        const message = error && error.message ? error.message : String(error);
        __FOCUS_NEXT_CORE_GLOBAL__.showMessage(self, message);
        console.log(`[Focus Switch] 切换失败：${message}`);
      }
    },

    focusPrevious: function () {
      if (self.__focusNextSuppressTap) {
        self.__focusNextSuppressTap = false;
        return;
      }
      if (self.focusNextEnabled === false) return;
      try {
        __FOCUS_NEXT_CORE_GLOBAL__.focusPrevious(self);
      }
      catch (error) {
        const message = error && error.message ? error.message : String(error);
        __FOCUS_NEXT_CORE_GLOBAL__.showMessage(self, message);
        console.log(`[Focus Switch] 切换失败：${message}`);
      }
    },

    handleFocusNextButtonPan: function (recognizer) {
      __FOCUS_NEXT_UI_GLOBAL__.handleNextPan(self, recognizer);
    },

    handleFocusPreviousButtonPan: function (recognizer) {
      __FOCUS_NEXT_UI_GLOBAL__.handlePreviousPan(self, recognizer);
    },
    handleFocusSourceButtonPan: function (recognizer) {
      __FOCUS_NEXT_UI_GLOBAL__.handleSourcePan(self, recognizer);
    },
    handleFocusCollapseCommentsPan: function (recognizer) {
      __FOCUS_NEXT_UI_GLOBAL__.handleCollapseCommentsPan(self, recognizer);
    },
    handleFocusExpandCommentsPan: function (recognizer) {
      __FOCUS_NEXT_UI_GLOBAL__.handleExpandCommentsPan(self, recognizer);
    },
  });
}
