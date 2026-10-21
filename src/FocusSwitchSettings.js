var __FOCUS_NEXT_SETTINGS_GLOBAL__ = (function () {
  const PANEL_WIDTH = 340;
  const HEADER_HEIGHT = 44;
  const MASTER_ROW_HEIGHT = 44;
  const FOOTER_HEIGHT = 16;
  const FOOTER_TOP_MARGIN = 8;
  const FOOTER_BOTTOM_MARGIN = 8;
  const SWITCH_SCALE = 0.85;
  const PANEL_HEIGHT = 496;
  const ROW_HEIGHT = 54;
  const DETAIL_ROW_HEIGHT = 76;
  const PANEL_POSITION_KEY = "cn.marginnote.focus-next.settings-panel-position";
  const SECTIONS_KEY = "cn.marginnote.focus-next.settings-sections";
  const EDGE_MARGIN = 12;
  const options = [
    { key: "enabled", title: "启用焦点切换", action: "setFocusEnabled:" },
    { key: "iconDisplay", title: "按钮样式", segments: ["文字", "图标"], action: "setButtonStyle:" },
    { key: "groupedDisplay", title: "按钮布局", segments: ["分散", "集中"], action: "setButtonLayout:" },
    { key: "groupDirection", title: "排列方向", segments: ["竖向", "横向"], action: "setGroupDirection:" },
    { key: "crossLevel", title: "切换范围", segments: ["同级", "整张脑图"], controlWidth: 140, description: "仅切换当前卡片的同级兄弟卡片，到首尾时停止。", action: "setNavigationScope:" },
    { key: "next", title: "下一张", action: "setNextEnabled:" },
    { key: "previous", title: "上一张", action: "setPreviousEnabled:" },
    { key: "source", title: "查看原题", action: "setSourceEnabled:" },
    { key: "collapseComments", title: "折叠评论", action: "setCollapseCommentsEnabled:" },
    { key: "expandComments", title: "展开评论", action: "setExpandCommentsEnabled:" },
  ];
  const sections = [
    { key: "appearance", before: "iconDisplay", title: "外观与排列", keys: ["iconDisplay", "groupedDisplay", "groupDirection"], action: "toggleAppearanceSection:" },
    { key: "navigation", before: "crossLevel", title: "卡片切换", keys: ["crossLevel"], action: "toggleNavigationSection:" },
    { key: "buttons", before: "next", title: "显示按钮", keys: ["next", "previous", "source", "collapseComments", "expandComments"], action: "toggleButtonsSection:" },
  ];

  function readSections() {
    const result = { appearance: true, navigation: false, buttons: false };
    try {
      const stored = NSUserDefaults.standardUserDefaults().objectForKey(SECTIONS_KEY);
      const value = stored === undefined || stored === null ? null : JSON.parse(String(stored));
      sections.forEach(function (section) {
        if (value && typeof value[section.key] === "boolean") result[section.key] = value[section.key];
      });
    } catch (ignored) {}
    return result;
  }

  function viewFor(addon) {
    const application = Application.sharedInstance();
    const controller = application && typeof application.studyController === "function"
      ? application.studyController(addon.window) : undefined;
    return controller && controller.view;
  }

  function label(text, size, bold) {
    const result = new UILabel({ x: 0, y: 0, width: 0, height: 0 });
    result.text = text;
    result.font = bold ? UIFont.boldSystemFontOfSize(size) : UIFont.systemFontOfSize(size);
    result.textColor = bold ? UIColor.darkGrayColor() : UIColor.grayColor();
    result.numberOfLines = bold ? 1 : 2;
    return result;
  }

  function footerText(addon) {
    let metadata;
    try {
      const path = String(addon && addon.__focusNextMainPath || "").replace(/\/+$/, "");
      if (path && typeof NSData !== "undefined" && typeof NSData.dataWithContentsOfFile === "function" &&
        typeof NSJSONSerialization !== "undefined" && typeof NSJSONSerialization.JSONObjectWithDataOptions === "function") {
        const data = NSData.dataWithContentsOfFile(`${path}/mnaddon.json`);
        if (data) metadata = NSJSONSerialization.JSONObjectWithDataOptions(data, 0);
      }
    } catch (error) { console.log(`[Focus Switch] 读取插件版本失败：${error && error.message || error}`); }
    function field(key, fallback) {
      let value = metadata && metadata[key];
      if (value === undefined && metadata && typeof metadata.objectForKey === "function") value = metadata.objectForKey(key);
      return value === undefined || value === null || !String(value).trim() ? fallback : String(value).trim();
    }
    return `${field("title", "Focus Switch")} · ${field("author", "乔木Joe")} · ${field("version", "未知版本")}`;
  }

  function readPosition() {
    try {
      const stored = NSUserDefaults.standardUserDefaults().objectForKey(PANEL_POSITION_KEY);
      if (stored === undefined || stored === null) return undefined;
      const position = JSON.parse(String(stored));
      if (!position || typeof position.xRatio !== "number" || typeof position.yRatio !== "number" ||
        !Number.isFinite(position.xRatio) || !Number.isFinite(position.yRatio)) return undefined;
      return { xRatio: Math.max(0, Math.min(1, position.xRatio)), yRatio: Math.max(0, Math.min(1, position.yRatio)) };
    } catch (error) { return undefined; }
  }

  function clampPosition(x, y, width, height, bounds) {
    return {
      x: Math.max(EDGE_MARGIN, Math.min(Math.max(EDGE_MARGIN, bounds.width - width - EDGE_MARGIN), x)),
      y: Math.max(EDGE_MARGIN, Math.min(Math.max(EDGE_MARGIN, bounds.height - height - EDGE_MARGIN), y)),
      width, height,
    };
  }

  function savePosition(menu) {
    if (!menu || !menu.panel.superview) return;
    const bounds = menu.panel.superview.bounds;
    const frame = menu.panel.frame;
    const rangeX = Math.max(0, bounds.width - frame.width - EDGE_MARGIN * 2);
    const rangeY = Math.max(0, bounds.height - frame.height - EDGE_MARGIN * 2);
    // 按可移动区域保存比例，适应横竖屏和分屏尺寸。
    menu.position = {
      xRatio: rangeX > 0 ? Math.max(0, Math.min(1, (frame.x - EDGE_MARGIN) / rangeX)) : 0,
      yRatio: rangeY > 0 ? Math.max(0, Math.min(1, (frame.y - EDGE_MARGIN) / rangeY)) : 0,
    };
    try {
      NSUserDefaults.standardUserDefaults().setObjectForKey(JSON.stringify(menu.position), PANEL_POSITION_KEY);
    } catch (error) { console.log(`[Focus Switch] 保存菜单位置失败：${error && error.message || error}`); }
  }

  function create(addon) {
    const panel = new UIView({ x: 0, y: 0, width: PANEL_WIDTH, height: PANEL_HEIGHT });
    panel.backgroundColor = UIColor.whiteColor();
    panel.layer.cornerRadius = 12;
    panel.layer.masksToBounds = true;
    panel.layer.borderWidth = 0.5;
    panel.layer.borderColor = UIColor.lightGrayColor();
    const header = new UIView({ x: 0, y: 0, width: PANEL_WIDTH - 60, height: HEADER_HEIGHT });
    header.addGestureRecognizer(new UIPanGestureRecognizer(addon, "handleFocusSettingsPan:"));
    panel.addSubview(header);
    const title = label("Focus Switch", 17, true);
    header.addSubview(title);
    const close = new UIButton({ x: 0, y: 0, width: 44, height: 44 });
    const closeImage = typeof close.setImageForState === "function" ? __FOCUS_NEXT_ICONS_GLOBAL__.image(addon, "panel-close") : null;
    if (closeImage) close.setImageForState(closeImage, 0);
    close.setTitleForState(closeImage ? "" : "关闭", 0);
    close.setTitleColorForState(UIColor.colorWithRedGreenBlueAlpha(0.12, 0.42, 0.78, 1), 0);
    close.titleLabel.font = UIFont.systemFontOfSize(14);
    close.addTargetActionForControlEvents(addon, "closeFocusSettings:", 1 << 6);
    panel.addSubview(close);
    const scroll = new UIScrollView({ x: 0, y: HEADER_HEIGHT + MASTER_ROW_HEIGHT, width: PANEL_WIDTH, height: PANEL_HEIGHT - HEADER_HEIGHT - MASTER_ROW_HEIGHT });
    scroll.showsHorizontalScrollIndicator = false;
    scroll.alwaysBounceVertical = false;
    panel.addSubview(scroll);
    const footer = label(footerText(addon), 10, false);
    footer.numberOfLines = 1;
    footer.textAlignment = 1;
    footer.textColor = UIColor.colorWithRedGreenBlueAlpha(115 / 255, 124 / 255, 137 / 255, 1);
    scroll.addSubview(footer);
    const rows = options.map(function (option, index) {
      const title = label(option.title, 15, option.key === "enabled");
      if (option.key !== "enabled") title.textColor = UIColor.darkGrayColor();
      const description = label(option.description || "", 12, false);
      description.hidden = !option.description;
      const control = option.segments ? new UISegmentedControl({ x: 0, y: 0, width: 112, height: 31 })
        : new UISwitch({ x: 0, y: 0, width: 51, height: 31 });
      if (option.segments) {
        option.segments.forEach(function (text, index) { control.insertSegmentWithTitleAtIndexAnimated(text, index, false); });
        control.momentary = false;
      }
      control.addTargetActionForControlEvents(addon, option.action, 1 << 12);
      const hitButton = option.segments ? null : new UIButton({ x: 0, y: 0, width: 0, height: 44 });
      if (hitButton) {
        hitButton.tag = index;
        hitButton.addTargetActionForControlEvents(addon, "toggleSettingsSwitchRow:", 1 << 6);
        scroll.addSubview(hitButton);
      }
      const divider = new UIView({ x: 0, y: 0, width: 0, height: 0.5 });
      divider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.35);
      [title, description, control, divider].forEach(function (view) { scroll.addSubview(view); });
      return { key: option.key, title, description, control, divider, hitButton, segmented: Boolean(option.segments), controlWidth: option.controlWidth };
    });
    const master = rows[0];
    [master.hitButton, master.title, master.description, master.control, master.divider].forEach(function (view) { panel.addSubview(view); });
    const expanded = readSections();
    const groups = sections.map(function (section) {
      const button = new UIButton({ x: 0, y: 0, width: 0, height: 56 });
      button.backgroundColor = UIColor.whiteColor();
      button.addTargetActionForControlEvents(addon, section.action, 1 << 6);
      const title = label(section.title, 15, true);
      const description = label("", 12, false);
      description.numberOfLines = 1;
      const arrow = typeof UIImageView !== "undefined" ? new UIImageView({ x: 0, y: 0, width: 14, height: 14 })
        : new UIView({ x: 0, y: 0, width: 14, height: 14 });
      const divider = new UIView({ x: 0, y: 0, width: 0, height: 0.5 });
      divider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.35);
      [title, description, arrow, divider].forEach(function (view) { button.addSubview(view); });
      scroll.addSubview(button);
      return { key: section.key, before: section.before, keys: section.keys, button, title, description, arrow, divider, expanded: expanded[section.key] };
    });
    const commentsHint = label("开关控制浮动按钮是否显示。", 12, false);
    const directionHint = label("", 12, false);
    scroll.addSubview(commentsHint);
    scroll.addSubview(directionHint);
    return { panel, header, title, close, scroll, footer, rows, groups, commentsHint, directionHint, position: readPosition(), dragging: false };
  }

  function layout(addon, keepOrigin) {
    const menu = addon && addon.__focusNextSettings;
    if (!menu || !menu.panel.superview) return;
    const bounds = menu.panel.superview.bounds;
    const width = Math.min(PANEL_WIDTH, Math.max(0, Number(bounds.width) - 24));
    const top = Math.min(100, Math.max(12, Number(bounds.height) - 180));
    let contentHeight = FOOTER_TOP_MARGIN + FOOTER_HEIGHT + FOOTER_BOTTOM_MARGIN;
    menu.groups.forEach(function (group) {
      contentHeight += 56;
      if (group.expanded) {
        group.keys.forEach(function (key) {
          const row = menu.rows.find(function (item) { return item.key === key; });
          contentHeight += row.description.text ? DETAIL_ROW_HEIGHT : ROW_HEIGHT;
        });
        if (group.key === "appearance" || group.key === "buttons") contentHeight += 40;
      }
    });
    // 根据展开内容缩短面板，分屏空间不足时只滚动分组区域。
    const height = Math.min(PANEL_HEIGHT, HEADER_HEIGHT + MASTER_ROW_HEIGHT + contentHeight, Math.max(0, Number(bounds.height) - top - 12));
    const rangeX = Math.max(0, Number(bounds.width) - width - EDGE_MARGIN * 2);
    const rangeY = Math.max(0, Number(bounds.height) - height - EDGE_MARGIN * 2);
    const position = menu.position;
    const x = menu.dragging || keepOrigin ? menu.panel.frame.x : position ? EDGE_MARGIN + position.xRatio * rangeX : Number(bounds.width) - width - EDGE_MARGIN;
    const panelY = menu.dragging || keepOrigin ? menu.panel.frame.y : position ? EDGE_MARGIN + position.yRatio * rangeY : top;
    menu.panel.frame = clampPosition(x, panelY, width, height, bounds);
    menu.header.frame = { x: 0, y: 0, width: Math.max(0, width - 60), height: HEADER_HEIGHT };
    menu.title.frame = { x: 16, y: 6, width: Math.max(0, width - 76), height: 32 };
    menu.close.frame = { x: width - 52, y: 0, width: 44, height: 44 };
    menu.scroll.frame = { x: 0, y: HEADER_HEIGHT + MASTER_ROW_HEIGHT, width, height: Math.max(0, height - HEADER_HEIGHT - MASTER_ROW_HEIGHT) };
    let y = 0;
    menu.rows.forEach(function (row) {
      const group = menu.groups.find(function (item) { return item.keys.indexOf(row.key) >= 0; });
      row.hidden = Boolean(group && !group.expanded);
      row.title.hidden = row.control.hidden = row.hidden;
      if (row.hitButton) row.hitButton.hidden = row.hidden;
      row.description.hidden = row.hidden || !row.description.text;
    });
    function placeRow(row, rowY, indent, first) {
      const rowHeight = row.key === "enabled" ? MASTER_ROW_HEIGHT : row.description.text ? DETAIL_ROW_HEIGHT : ROW_HEIGHT;
      const controlWidth = row.controlWidth || (row.segmented ? 112 : 51);
      row.title.frame = { x: indent, y: rowY + (row.description.text ? 8 : (rowHeight - 24) / 2), width: Math.max(0, width - controlWidth - indent - 33), height: 24 };
      row.description.frame = { x: indent, y: rowY + 38, width: Math.max(0, width - indent - 16), height: row.description.text ? 30 : 0 };
      const layer = row.control.layer;
      const scaleSwitch = !row.segmented && layer && typeof layer.setAffineTransform === "function";
      // 先还原再定位，避免重复布局累积缩放；视觉右缘仍与其他控件对齐。
      if (scaleSwitch) layer.setAffineTransform({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
      row.control.frame = { x: width - controlWidth - 16, y: rowY + (row.description.text ? 5 : (rowHeight - 31) / 2), width: controlWidth, height: 31 };
      if (scaleSwitch) layer.setAffineTransform({ a: SWITCH_SCALE, b: 0, c: 0, d: SWITCH_SCALE, tx: controlWidth * (1 - SWITCH_SCALE) / 2, ty: 0 });
      if (row.hitButton) row.hitButton.frame = { x: indent, y: rowY, width: Math.max(0, width - indent - 16), height: rowHeight };
      row.divider.frame = { x: indent, y: rowY, width: Math.max(0, width - indent - 16), height: 0.5 };
      row.divider.hidden = row.hidden || first;
      return rowHeight;
    }
    placeRow(menu.rows[0], HEADER_HEIGHT, 16, true);
    menu.commentsHint.hidden = menu.directionHint.hidden = true;
    menu.groups.forEach(function (group) {
      group.button.frame = { x: 0, y, width, height: 56 };
      const count = group.key === "buttons";
      group.title.frame = { x: 16, y: count ? 16 : 6, width: Math.max(0, width - (count ? 142 : 60)), height: 24 };
      group.description.frame = count ? { x: width - 122, y: 19, width: 78, height: 18 }
        : { x: 16, y: 31, width: Math.max(0, width - 60), height: 18 };
      group.arrow.frame = { x: width - 34, y: 21, width: 14, height: 14 };
      if (typeof UIImageView !== "undefined") group.arrow.image = __FOCUS_NEXT_ICONS_GLOBAL__.image(addon, group.expanded ? "section-chevron-down" : "section-chevron-right");
      group.divider.frame = { x: 16, y: 0, width: Math.max(0, width - 32), height: 0.5 };
      y += 56;
      group.keys.forEach(function (key, index) {
        const row = menu.rows.find(function (item) { return item.key === key; });
        const rowHeight = placeRow(row, y, 28, index === 0);
        if (group.expanded) y += rowHeight;
      });
      const hint = group.key === "appearance" ? menu.directionHint : group.key === "buttons" ? menu.commentsHint : null;
      if (hint && group.expanded) {
        hint.hidden = false;
        hint.frame = { x: 28, y: y + 6, width: Math.max(0, width - 44), height: 30 };
        y += 40;
      }
    });
    const footerY = y + FOOTER_TOP_MARGIN;
    menu.footer.frame = { x: 12, y: footerY, width: Math.max(0, width - 24), height: FOOTER_HEIGHT };
    menu.scroll.contentSize = { width, height: footerY + FOOTER_HEIGHT + FOOTER_BOTTOM_MARGIN };
    const oldOffset = menu.scroll.contentOffset;
    menu.scroll.contentOffset = { x: 0, y: Math.max(0, Math.min(Number(oldOffset && oldOffset.y) || 0, menu.scroll.contentSize.height - menu.scroll.frame.height)) };
    if (keepOrigin) savePosition(menu);
  }

  function refresh(addon) {
    const menu = addon && addon.__focusNextSettings;
    if (!menu) return;
    const core = __FOCUS_NEXT_CORE_GLOBAL__;
    const states = { enabled: core.enabled(), crossLevel: core.crossLevelEnabled(), next: core.nextEnabled(), previous: core.previousEnabled(), source: core.sourceEnabled(),
      collapseComments: core.collapseCommentsEnabled(), expandComments: core.expandCommentsEnabled(), iconDisplay: core.iconDisplay(), groupedDisplay: core.groupedDisplay() };
    menu.rows.forEach(function (row) {
      if (row.key === "groupDirection") row.control.selectedSegmentIndex = core.horizontalLayout() ? 1 : 0;
      else if (row.key === "iconDisplay") row.control.selectedSegmentIndex = core.iconDisplay() ? 1 : 0;
      else if (row.key === "groupedDisplay") row.control.selectedSegmentIndex = core.groupedDisplay() ? 1 : 0;
      else if (row.key === "crossLevel") {
        row.control.selectedSegmentIndex = core.crossLevelEnabled() ? 1 : 0;
        row.description.text = core.crossLevelEnabled() ? "按脑图顺序先父卡片、再子卡片，到整张脑图首尾时停止。"
          : "仅切换当前卡片的同级兄弟卡片，到首尾时停止。";
      }
      else row.control.on = states[row.key];
    });
    menu.groups[0].description.text = `${core.iconDisplay() ? "图标" : "文字"} · ${core.groupedDisplay() ? "集中" : "分散"} · ${core.horizontalLayout() ? "横向" : "竖向"}`;
    menu.groups[1].description.text = core.crossLevelEnabled() ? "整张脑图" : "同级卡片";
    const count = ["next", "previous", "source", "collapseComments", "expandComments"].filter(function (key) { return states[key]; }).length;
    menu.groups[2].description.text = `已开启 ${count}/5`;
    menu.directionHint.text = core.groupedDisplay() ? "拖动任意按钮可移动整组。" : "排列方向在集中布局时生效。";
    layout(addon);
  }

  function toggleSection(addon, key) {
    const menu = addon && addon.__focusNextSettings;
    if (!menu || !menu.panel.superview || menu.dragging) return;
    const group = menu.groups.find(function (item) { return item.key === key; });
    if (!group) return;
    group.expanded = !group.expanded;
    const stored = {};
    menu.groups.forEach(function (item) { stored[item.key] = item.expanded; });
    try { NSUserDefaults.standardUserDefaults().setObjectForKey(JSON.stringify(stored), SECTIONS_KEY); }
    catch (error) { console.log(`[Focus Switch] 保存分组状态失败：${error && error.message || error}`); }
    layout(addon, true);
  }

  function toggleSwitchRow(addon, sender) {
    const menu = addon && addon.__focusNextSettings;
    if (!menu || !menu.panel.superview || menu.dragging || !sender) return;
    const index = Number(sender.tag);
    if (!Number.isInteger(index)) return;
    const row = menu.rows[index];
    if (!row || !row.hitButton || row.hidden || row.segmented) return;
    __FOCUS_NEXT_COMMANDS_GLOBAL__.apply(addon, row.key, !Boolean(row.control.on));
  }

  function hide(addon) {
    if (addon) addon.__focusNextMenuToken = Number(addon.__focusNextMenuToken || 0) + 1;
    const menu = addon && addon.__focusNextSettings;
    if (menu && menu.dragging) savePosition(menu);
    if (menu) menu.dragging = false;
    if (menu && menu.panel.superview) menu.panel.removeFromSuperview();
  }

  function handlePan(addon, recognizer) {
    const menu = addon && addon.__focusNextSettings;
    const view = menu && menu.panel.superview;
    if (!view || !recognizer) return;
    const state = Number(recognizer.state);
    if (state === 1) { menu.dragging = true; return; }
    if (state === 2 && menu.dragging) {
      const translation = recognizer.translationInView(view);
      const frame = menu.panel.frame;
      const dx = Number(translation && translation.x);
      const dy = Number(translation && translation.y);
      if (Number.isFinite(dx) && Number.isFinite(dy)) {
        menu.panel.frame = clampPosition(frame.x + dx, frame.y + dy, frame.width, frame.height, view.bounds);
      }
      recognizer.setTranslationInView({ x: 0, y: 0 }, view);
      return;
    }
    if (state === 3 || state === 4 || state === 5) {
      if (menu.dragging) savePosition(menu);
      menu.dragging = false;
    }
  }

  function watchSize(addon, token, lastWidth, lastHeight) {
    const menu = addon && addon.__focusNextSettings;
    if (!menu || !menu.panel.superview || addon.__focusNextMenuToken !== token) return;
    const bounds = menu.panel.superview.bounds;
    if (bounds.width !== lastWidth || bounds.height !== lastHeight) layout(addon);
    if (typeof NSTimer !== "undefined" && typeof NSTimer.scheduledTimerWithTimeInterval === "function") {
      NSTimer.scheduledTimerWithTimeInterval(0.2, false, function () { watchSize(addon, token, bounds.width, bounds.height); });
    }
  }

  function toggle(addon) {
    const menu = addon.__focusNextSettings;
    if (menu && menu.panel.superview) { hide(addon); return false; }
    const view = viewFor(addon);
    if (!view) return false;
    if (!menu) addon.__focusNextSettings = create(addon);
    view.addSubview(addon.__focusNextSettings.panel);
    refresh(addon);
    layout(addon);
    const token = Number(addon.__focusNextMenuToken || 0) + 1;
    addon.__focusNextMenuToken = token;
    watchSize(addon, token);
    return true;
  }

  function remove(addon) { hide(addon); if (addon) addon.__focusNextSettings = null; }
  return { toggle, hide, remove, refresh, layout, handlePan, toggleSection, toggleSwitchRow };
})();
