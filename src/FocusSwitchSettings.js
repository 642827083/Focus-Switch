var __FOCUS_NEXT_SETTINGS_GLOBAL__ = (function () {
  const PANEL_WIDTH = 340;
  const HEADER_HEIGHT = 56;
  const FOOTER_HEIGHT = 16;
  const FOOTER_TOP_MARGIN = 15;
  // 对齐 Ink to Card 的 12 点页面底部内边距与 2 点页脚外边距。
  const FOOTER_BOTTOM_MARGIN = 14;
  const ROW_HEIGHT = 88;
  const MAX_VISIBLE_ROWS = 5;
  const PANEL_POSITION_KEY = "cn.marginnote.focus-next.settings-panel-position";
  const EDGE_MARGIN = 12;
  const options = [
    { key: "enabled", title: "启用焦点切换", description: "控制全部浮动按钮，关闭后全部隐藏", action: "setFocusEnabled:" },
    { key: "iconDisplay", title: "图标展示", description: "用图标替换五个按钮的文字，保持方形按钮样式", action: "setIconDisplay:" },
    { key: "groupedDisplay", title: "集中显示", description: "将已启用的按钮排在一起，支持整组拖动", action: "setGroupedDisplay:" },
    { key: "groupDirection", title: "排列方向", description: "集中显示时生效", action: "setGroupDirection:" },
    { key: "crossLevel", title: "跨层级切换", description: "按脑图层级连续切换全部卡片", action: "setCrossLevelEnabled:" },
    { key: "previous", title: "显示上一张", description: "关闭后隐藏上一张按钮，保留下一张", action: "setPreviousEnabled:" },
    { key: "source", title: "查看原题", description: "选中题卡或进入焦点后，在对应插件面板中查看原题", action: "setSourceEnabled:" },
    { key: "collapseComments", title: "显示折叠评论", description: "保留正文第一项，有主摘录时折叠全部评论", action: "setCollapseCommentsEnabled:" },
    { key: "expandComments", title: "显示展开评论", description: "显示展开按钮，展开所选卡片的全部评论", action: "setExpandCommentsEnabled:" },
  ];

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
    const panel = new UIView({ x: 0, y: 0, width: PANEL_WIDTH, height: HEADER_HEIGHT + Math.min(options.length, MAX_VISIBLE_ROWS) * ROW_HEIGHT });
    panel.backgroundColor = UIColor.whiteColor();
    panel.layer.cornerRadius = 12;
    panel.layer.masksToBounds = true;
    panel.layer.borderWidth = 0.5;
    panel.layer.borderColor = UIColor.lightGrayColor();
    const header = new UIView({ x: 0, y: 0, width: PANEL_WIDTH - 72, height: HEADER_HEIGHT });
    header.addGestureRecognizer(new UIPanGestureRecognizer(addon, "handleFocusSettingsPan:"));
    panel.addSubview(header);
    const title = label("Focus Switch", 17, true);
    header.addSubview(title);
    const close = new UIButton({ x: 0, y: 0, width: 56, height: 44 });
    close.setTitleForState("关闭", 0);
    close.setTitleColorForState(UIColor.colorWithRedGreenBlueAlpha(0.12, 0.42, 0.78, 1), 0);
    close.titleLabel.font = UIFont.systemFontOfSize(14);
    close.addTargetActionForControlEvents(addon, "closeFocusSettings:", 1 << 6);
    panel.addSubview(close);
    const scroll = new UIScrollView({ x: 0, y: HEADER_HEIGHT, width: PANEL_WIDTH, height: options.length * ROW_HEIGHT });
    scroll.showsHorizontalScrollIndicator = false;
    scroll.alwaysBounceVertical = false;
    panel.addSubview(scroll);
    const footer = label(footerText(addon), 10, false);
    footer.numberOfLines = 1;
    footer.textAlignment = 1;
    footer.textColor = UIColor.colorWithRedGreenBlueAlpha(115 / 255, 124 / 255, 137 / 255, 1);
    scroll.addSubview(footer);
    const rows = options.map(function (option) {
      const title = label(option.title, 15, true);
      const description = label(option.description, 12, false);
      const direction = option.key === "groupDirection";
      const control = direction ? new UISegmentedControl({ x: 0, y: 0, width: 112, height: 31 })
        : new UISwitch({ x: 0, y: 0, width: 51, height: 31 });
      if (direction) {
        control.insertSegmentWithTitleAtIndexAnimated("竖向", 0, false);
        control.insertSegmentWithTitleAtIndexAnimated("横向", 1, false);
        control.momentary = false;
      }
      control.addTargetActionForControlEvents(addon, option.action, 1 << 12);
      const divider = new UIView({ x: 0, y: 0, width: 0, height: 0.5 });
      divider.backgroundColor = UIColor.lightGrayColor().colorWithAlphaComponent(0.35);
      [title, description, control, divider].forEach(function (view) { scroll.addSubview(view); });
      return { key: option.key, title, description, control, divider };
    });
    return { panel, header, title, close, scroll, footer, rows, position: readPosition(), dragging: false };
  }

  function layout(addon) {
    const menu = addon && addon.__focusNextSettings;
    if (!menu || !menu.panel.superview) return;
    const bounds = menu.panel.superview.bounds;
    const width = Math.min(PANEL_WIDTH, Math.max(0, Number(bounds.width) - 24));
    const top = Math.min(100, Math.max(12, Number(bounds.height) - 180));
    // 保持原有窄面板高度，新增选项通过滚动访问，避免失去拖动空间。
    const height = Math.min(HEADER_HEIGHT + Math.min(options.length, MAX_VISIBLE_ROWS) * ROW_HEIGHT, Math.max(0, Number(bounds.height) - top - 12));
    const rangeX = Math.max(0, Number(bounds.width) - width - EDGE_MARGIN * 2);
    const rangeY = Math.max(0, Number(bounds.height) - height - EDGE_MARGIN * 2);
    const position = menu.position;
    const x = menu.dragging ? menu.panel.frame.x : position ? EDGE_MARGIN + position.xRatio * rangeX : Number(bounds.width) - width - EDGE_MARGIN;
    const y = menu.dragging ? menu.panel.frame.y : position ? EDGE_MARGIN + position.yRatio * rangeY : top;
    menu.panel.frame = clampPosition(x, y, width, height, bounds);
    menu.header.frame = { x: 0, y: 0, width: Math.max(0, width - 72), height: HEADER_HEIGHT };
    menu.title.frame = { x: 16, y: 12, width: Math.max(0, width - 88), height: 32 };
    menu.close.frame = { x: width - 64, y: 6, width: 56, height: 44 };
    const footerY = options.length * ROW_HEIGHT + FOOTER_TOP_MARGIN;
    menu.footer.frame = { x: 12, y: footerY, width: Math.max(0, width - 24), height: FOOTER_HEIGHT };
    menu.scroll.frame = { x: 0, y: HEADER_HEIGHT, width, height: Math.max(0, height - HEADER_HEIGHT) };
    menu.scroll.contentSize = { width, height: footerY + FOOTER_HEIGHT + FOOTER_BOTTOM_MARGIN };
    menu.rows.forEach(function (row, index) {
      const y = index * ROW_HEIGHT;
      const controlWidth = row.key === "groupDirection" ? 112 : 51;
      row.title.frame = { x: 16, y: y + 12, width: Math.max(0, width - controlWidth - 49), height: 24 };
      row.description.frame = { x: 16, y: y + 38, width: Math.max(0, width - controlWidth - 49), height: 38 };
      row.control.frame = { x: width - controlWidth - 16, y: y + 26, width: controlWidth, height: 31 };
      row.divider.frame = { x: 16, y, width: Math.max(0, width - 32), height: 0.5 };
    });
  }

  function refresh(addon) {
    const menu = addon && addon.__focusNextSettings;
    if (!menu) return;
    const core = __FOCUS_NEXT_CORE_GLOBAL__;
    const states = { enabled: core.enabled(), crossLevel: core.crossLevelEnabled(), previous: core.previousEnabled(), source: core.sourceEnabled(),
      collapseComments: core.collapseCommentsEnabled(), expandComments: core.expandCommentsEnabled(), iconDisplay: core.iconDisplay(), groupedDisplay: core.groupedDisplay() };
    menu.rows.forEach(function (row) {
      if (row.key === "groupDirection") row.control.selectedSegmentIndex = core.horizontalLayout() ? 1 : 0;
      else row.control.on = states[row.key];
    });
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
  return { toggle, hide, remove, refresh, layout, handlePan };
})();
