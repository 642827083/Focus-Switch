var __FOCUS_NEXT_AI_WORKFLOWS_GLOBAL__ = (function () {
  const REQUEST = "cn.marginnote.ai-bridge.workflow.request.v1", RESPONSE = "cn.marginnote.ai-bridge.workflow.response.v1";
  const sites = { deepseek: "DeepSeek", doubao: "豆包", gpt: "ChatGPT", gemini: "Gemini" };
  function value(object, key) {
    let result = object && object[key];
    if (result === undefined && object && typeof object.objectForKey === "function") result = object.objectForKey(key);
    return typeof result === "function" ? result.call(object) : result;
  }
  function center() { return typeof NSNotificationCenter !== "undefined" ? NSNotificationCenter.defaultCenter() : null; }
  function connect(addon) {
    const c = center();
    if (!c || typeof c.addObserverSelectorName !== "function") return;
    disconnect(addon); c.addObserverSelectorName(addon, "receiveAiWorkflows:", RESPONSE); addon.__focusNextAiObserver = true;
  }
  function close(addon) {
    if (!addon) return;
    const menu = addon.__focusNextAiMenu; addon.__focusNextAiMenu = null;
    if (menu) menu.view.removeFromSuperview();
    const pending = addon.__focusNextAiRequest; addon.__focusNextAiRequest = null;
    if (pending && pending.timer) pending.timer.invalidate();
  }
  function disconnect(addon) {
    close(addon);
    if (addon.__focusNextAiObserver) center().removeObserverName(addon, RESPONSE);
    addon.__focusNextAiObserver = false;
  }
  function request(addon, payload, callback) {
    const c = center();
    if (!addon.__focusNextAiObserver || !c || typeof c.postNotificationNameObjectUserInfo !== "function") { callback({ ok: false, error: "请安装并启用支持联动的 AI Bridge 版本" }); return; }
    const id = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    const pending = { id, callback }; addon.__focusNextAiRequest = pending;
    pending.timer = NSTimer.scheduledTimerWithTimeInterval(1.5, false, function () {
      if (addon.__focusNextAiRequest !== pending) return;
      addon.__focusNextAiRequest = null; callback({ ok: false, error: "未收到 AI Bridge 响应，请确认已安装并启用联动版本" });
    });
    try { c.postNotificationNameObjectUserInfo(REQUEST, addon.window, { payload: JSON.stringify(Object.assign({ version: 1, requestId: id }, payload)) }); }
    catch (error) { pending.timer.invalidate(); addon.__focusNextAiRequest = null; callback({ ok: false, error: "暂时无法连接 AI Bridge" }); }
  }
  function receive(addon, notification) {
    try {
      if (value(notification, "object") !== addon.window) return;
      const text = value(value(notification, "userInfo"), "payload"), pending = addon.__focusNextAiRequest;
      if (!pending || typeof text !== "string" || text.length > 16384) return;
      const response = JSON.parse(text);
      if (response.version !== 1 || response.requestId !== pending.id) return;
      addon.__focusNextAiRequest = null; pending.timer.invalidate(); pending.callback(response);
    } catch (error) { console.log("[Focus Switch] AI Bridge 响应无法读取"); }
  }
  function label(parent, text, size, gray) {
    const view = new UILabel({ x: 0, y: 0, width: 0, height: 0 }); view.text = text;
    view.font = UIFont.systemFontOfSize(size); view.textColor = UIColor.colorWithRedGreenBlueAlpha(gray, gray, gray, 1);
    view.numberOfLines = 1; view.lineBreakMode = 4; view.userInteractionEnabled = false; parent.addSubview(view); return view;
  }
  function row(addon, menu, title, site, id) {
    const button = new UIButton({ x: 0, y: menu.rows.length * 44, width: menu.width, height: 44 });
    button.addTargetActionForControlEvents(addon, "chooseAiWorkflow:", 1 << 6);
    button.tag = menu.rows.length; button.__focusNextWorkflowId = id;
    button.__focusNextName = label(button, title, 14, .17);
    button.__focusNextSite = label(button, site, 11, .52); button.__focusNextSite.textAlignment = 2;
    menu.scroll.addSubview(button); menu.rows.push(button);
  }
  function placement(bounds, anchor, obstacles, width, height, alignment) {
    if (alignment) {
      // 横向工具栏按实际按钮右缘对齐，优先下方，完整高度放不下时选上方。
      const right = Math.min(bounds.width - 8, alignment.right), w = Math.min(width, right - 8);
      const below = bounds.height - 8 - alignment.bottom, above = alignment.top - 8;
      const down = below >= height || (above < height && below >= above);
      const h = Math.min(height, down ? below : above);
      if (w >= Math.min(120, width) && h >= Math.min(100, height)) return {
        x: right - w, y: down ? alignment.bottom : alignment.top - h, width: w, height: h,
      };
    }
    // 将按钮及整组工具栏从可用区域中扣除，面板只放在剩余空位。
    let areas = [{ x: 8, y: 8, width: bounds.width - 16, height: bounds.height - 16 }];
    obstacles.forEach(function (frame) {
      const b = { x: frame.x - 8, y: frame.y - 8, right: frame.x + frame.width + 8, bottom: frame.y + frame.height + 8 };
      areas = areas.reduce(function (result, a) {
        const right = a.x + a.width, bottom = a.y + a.height;
        if (b.x >= right || b.right <= a.x || b.y >= bottom || b.bottom <= a.y) result.push(a);
        else result.push({ x: a.x, y: a.y, width: b.x - a.x, height: a.height }, { x: b.right, y: a.y, width: right - b.right, height: a.height },
          { x: a.x, y: a.y, width: a.width, height: b.y - a.y }, { x: a.x, y: b.bottom, width: a.width, height: bottom - b.bottom });
        return result;
      }, []).filter(function (a) { return a.width >= Math.min(120, width) && a.height >= Math.min(100, height); });
      areas.sort(function (a, b) { return Math.min(b.width, width) * Math.min(b.height, height) - Math.min(a.width, width) * Math.min(a.height, height); });
      areas = areas.slice(0, 32);
    });
    const candidates = areas.map(function (a) {
      const w = Math.min(width, a.width), h = Math.min(height, a.height);
      const x = Math.max(a.x, Math.min(a.x + a.width - w, anchor.x - w - 8));
      const y = Math.max(a.y, Math.min(a.y + a.height - h, anchor.y - 4));
      const distance = Math.max(0, anchor.x - x - w, x - anchor.x - anchor.width) + Math.max(0, anchor.y - y - h, y - anchor.y - anchor.height);
      return { x, y, width: w, height: h, score: (width - w) * 4 + (height - h) * 2 + distance + (x + w <= anchor.x || x >= anchor.x + anchor.width ? 0 : 80) };
    });
    candidates.sort(function (a, b) { return a.score - b.score; });
    return candidates[0];
  }
  function layout(addon) {
    const menu = addon.__focusNextAiMenu;
    if (!menu) return;
    const bounds = menu.parent.bounds, button = addon.__focusAiButton;
    const group = addon.__focusNextGroup;
    // 原生 superview 的 JS 包装对象不一定相等，按插件布局状态判断分组。
    const grouped = __FOCUS_NEXT_CORE_GLOBAL__.groupedDisplay() && group && group.view.superview && !group.view.hidden;
    let anchor = button.frame;
    if (grouped) anchor = { x: anchor.x + group.view.frame.x, y: anchor.y + group.view.frame.y, width: anchor.width, height: anchor.height };
    const controls = grouped ? [group.view] :
      [addon.__focusProgressButton, addon.__focusPreviousButton, addon.__focusNextButton, addon.__focusAiButton, addon.__focusSourceButton, addon.__focusCollapseCommentsButton, addon.__focusExpandCommentsButton];
    const obstacles = controls.filter(function (view) { return view && !view.hidden && view.superview; }).map(function (view) { return view.frame; });
    const alignment = grouped && group.horizontal ? {
      right: group.view.frame.x + group.entries.reduce(function (right, entry) {
        return entry.button.hidden ? right : Math.max(right, entry.button.frame.x + entry.button.frame.width);
      }, 0), top: group.view.frame.y - 8, bottom: group.view.frame.y + group.view.frame.height + 8,
    } : null;
    const content = menu.rows.length * 44 + 40 + (menu.status.text ? 48 : 0) + 8;
    const frame = placement(bounds, anchor, obstacles, Math.min(286, bounds.width - 16), Math.min(400, bounds.height - 16, 44 + content), alignment);
    if (!frame) { close(addon); __FOCUS_NEXT_CORE_GLOBAL__.showMessage(addon, "请移动浮动按钮，为问 AI 面板留出空间"); return; }
    menu.width = frame.width; menu.view.frame = { x: frame.x, y: frame.y, width: frame.width, height: frame.height };
    menu.title.frame = { x: 16, y: 0, width: frame.width - 60, height: 44 };
    menu.dismiss.frame = { x: frame.width - 44, y: 0, width: 44, height: 44 };
    menu.scroll.frame = { x: 0, y: 44, width: frame.width, height: Math.max(0, frame.height - 44) };
    menu.divider.frame = { x: 16, y: 50, width: frame.width - 32, height: .5 };
    menu.sectionTitle.frame = { x: 16, y: 58, width: frame.width - 32, height: 24 };
    menu.rows.forEach(function (row, index) {
      row.frame = { x: 0, y: index * 44 + (index ? 40 : 0), width: frame.width, height: 44 };
      const siteWidth = row.__focusNextSite.text ? Math.min(78, frame.width * .28) : 0;
      row.__focusNextName.frame = { x: 16, y: 0, width: Math.max(0, frame.width - 32 - (siteWidth ? siteWidth + 12 : 0)), height: 44 };
      row.__focusNextName.numberOfLines = frame.width < 220 ? 2 : 1;
      row.__focusNextSite.frame = { x: frame.width - siteWidth - 16, y: 0, width: siteWidth, height: 44 };
    });
    menu.status.frame = { x: 16, y: menu.rows.length * 44 + 40, width: frame.width - 32, height: 48 };
    menu.scroll.contentSize = { width: frame.width, height: content };
  }
  function valid(addon, menu) {
    if (addon.focusNextEnabled === false || !__FOCUS_NEXT_CORE_GLOBAL__.aiEnabled() || Date.now() - menu.at > 60000) return false;
    const current = __FOCUS_NEXT_SOURCE_GLOBAL__.capture(addon, true), id = __FOCUS_NEXT_CORE_GLOBAL__.noteId(menu.context.note);
    return current && current.notebookId === menu.context.notebookId && (current.selected ? __FOCUS_NEXT_CORE_GLOBAL__.noteId(current.note) === id : current.focusId === menu.context.focusId || current.focusId === id);
  }
  function tick(addon) {
    const menu = addon.__focusNextAiMenu;
    if (!menu) return;
    try { if (!valid(addon, menu) || addon.__focusNextDragging) { close(addon); return; } layout(addon); }
    catch (error) { close(addon); }
  }
  function open(addon) {
    if (addon.__focusNextAiMenu) { close(addon); return; }
    const context = __FOCUS_NEXT_SOURCE_GLOBAL__.capture(addon, true);
    if (!context) return;
    const parent = Application.sharedInstance().studyController(addon.window).view;
    const width = Math.max(0, Math.min(286, parent.bounds.width - 16));
    const view = new UIView({ x: 0, y: 0, width, height: 120 }); view.backgroundColor = UIColor.whiteColor();
    view.layer.cornerRadius = 12; view.layer.masksToBounds = true; view.layer.borderWidth = .5; view.layer.borderColor = UIColor.lightGrayColor();
    const title = label(view, "问 AI", 14, .17); title.font = UIFont.boldSystemFontOfSize(14);
    const dismiss = new UIButton({ x: width - 44, y: 0, width: 44, height: 44 }); dismiss.setTitleForState("×", 0);
    dismiss.setTitleColorForState(UIColor.darkGrayColor(), 0); dismiss.addTargetActionForControlEvents(addon, "closeAiWorkflows:", 1 << 6); view.addSubview(dismiss);
    const scroll = new UIScrollView({ x: 0, y: 44, width, height: 80 }); view.addSubview(scroll);
    const menu = { view, parent, width, scroll, context, title, dismiss, rows: [], at: Date.now() }; addon.__focusNextAiMenu = menu;
    menu.divider = new UIView({ x: 0, y: 0, width: 0, height: .5 }); menu.divider.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(.9, .9, .92, 1);
    menu.divider.userInteractionEnabled = false; scroll.addSubview(menu.divider);
    menu.sectionTitle = label(scroll, "AI Bridge 工作流", 12, .48); menu.sectionTitle.font = UIFont.boldSystemFontOfSize(12);
    menu.status = label(scroll, "正在读取 AI Bridge 工作流…", 12, .52); menu.status.numberOfLines = 2;
    row(addon, menu, "题库网站问 AI", "", "website"); parent.addSubview(view); layout(addon);
    if (addon.__focusNextAiMenu !== menu) return;
    request(addon, { action: "list", noteId: __FOCUS_NEXT_CORE_GLOBAL__.noteId(context.note), notebookId: context.notebookId }, function (response) {
      if (addon.__focusNextAiMenu !== menu) return;
      if (!response.ok) menu.status.text = response.error || "无法读取 AI Bridge 工作流";
      else if (!Array.isArray(response.items) || response.items.length > 20 || typeof response.token !== "string") menu.status.text = "AI Bridge 返回的工作流列表无效";
      else {
        menu.token = response.token;
        response.items.forEach(function (item) {
          if (typeof item.id === "string" && /^wf-[a-z0-9-]{1,120}$/.test(item.id) && typeof item.name === "string" && item.name.length <= 24 && sites[item.site]) row(addon, menu, item.name, sites[item.site], item.id);
        });
        menu.status.text = menu.rows.length > 1 ? "" : "请先在 AI Bridge 中添加工作流";
      }
      layout(addon);
    });
  }
  function choose(addon, sender) {
    const menu = addon.__focusNextAiMenu;
    if (!menu || menu.rows[Number(sender.tag)] !== sender) return;
    try {
      if (!valid(addon, menu)) throw new Error("卡片或学习集已切换，请重新打开问 AI");
      const id = sender.__focusNextWorkflowId; close(addon);
      if (id === "website") __FOCUS_NEXT_SOURCE_GLOBAL__.open(addon, true, menu.context);
      else request(addon, { action: "run", token: menu.token, id }, function (response) { if (!response.ok) __FOCUS_NEXT_CORE_GLOBAL__.showMessage(addon, response.error || "无法执行工作流"); });
    } catch (error) { close(addon); __FOCUS_NEXT_CORE_GLOBAL__.showMessage(addon, String(error.message || error)); }
  }
  return { connect, disconnect, close, open, receive, choose, tick };
})();
