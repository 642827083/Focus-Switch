var __FOCUS_NEXT_SOURCE_GLOBAL__ = (function () {
  const PREFIX = "marginnote4app://addon/";

  function value(object, key) {
    try {
      let result = object && object[key];
      if (result === undefined && object && typeof object.objectForKey === "function") result = object.objectForKey(key);
      return typeof result === "function" ? result.call(object) : result;
    } catch (ignored) { return undefined; }
  }

  function items(list) {
    if (!list) return [];
    const nativeCount = value(list, "count");
    const count = Number(nativeCount === undefined ? value(list, "length") : nativeCount);
    const result = [];
    if (!Number.isSafeInteger(count) || count < 0) return result;
    for (let index = 0; index < count; index += 1) result.push(typeof list.objectAtIndex === "function" ? list.objectAtIndex(index) : list[index]);
    return result;
  }

  function integer(text, minimum) { const number = Number(text); return Number.isSafeInteger(number) && number >= minimum; }

  function noteFrom(entry) {
    let note = entry;
    for (let depth = 0; note && depth < 3 && !__FOCUS_NEXT_CORE_GLOBAL__.noteId(note); depth += 1) note = value(note, "note");
    return note && __FOCUS_NEXT_CORE_GLOBAL__.noteId(note) ? note : null;
  }

  function route(url) {
    if (typeof url !== "string" || url.indexOf(PREFIX) !== 0 || url.length > 32768) return null;
    const message = url.slice(PREFIX.length);
    let match = /^daguanyuan-bridge\?action=open&provider=(math|408)&question=([1-9]\d*)&year=(0|\d{4})&url=([^&]+)$/.exec(message);
    if (match) {
      if (!integer(match[2], 1) || Number(match[3]) !== 0 && (Number(match[3]) < 2009 || Number(match[3]) > 2100)) return null;
      let address;
      try { address = decodeURIComponent(match[4]); } catch (ignored) { return null; }
      if (address.length > 8192 || /[\s<>]/.test(address)) return null;
      if (match[1] === "math" ? !/^https:\/\/(?:www\.)?cxyonly\.fans\/math\/(?:practice\/(?:categories\/)?[1-9]\d*|questions\/[1-9]\d*)\/?(?:\?[^#]*)?$/.test(address)
        : !/^https:\/\/www\.408os\.cn\/exercise\?[^#]+$/.test(address)) return null;
      return { url, provider: "daguanyuan", source: match[1], questionId: Number(match[2]) };
    }
    match = /^yankean-bridge\?action=open&source=(math|naishua|mock|cse408)&question=([1-9]\d*)(?:&point=([1-9]\d*)&year=([1-9]\d*)&number=([1-9]\d*))?$/.exec(message);
    if (match) {
      if (!integer(match[2], 1) || (match[1] === "cse408") !== Boolean(match[3])) return null;
      if (match[1] === "cse408" && (!integer(match[3], 1) || !integer(match[5], 1) || Number(match[4]) < 1980 || Number(match[4]) > 2100)) return null;
      return { url, provider: "yankean", source: match[1], questionId: Number(match[2]) };
    }
    match = /^jifengjincao-bridge\?action=open&paper=(0|[1-9]\d*)&question=([1-9]\d*)$/.exec(message);
    if (match && integer(match[1], 0) && integer(match[2], 1)) return { url, provider: "jifengjincao", source: "paper", paperId: Number(match[1]), questionId: Number(match[2]) };
    return null;
  }

  function sourceFor(note) {
    const text = items(value(note, "comments")).map(function (comment) { return String(value(comment, "text") || ""); }).join("\n");
    const expression = /\[查看原题\]\((marginnote4app:\/\/addon\/(?:daguanyuan|yankean|jifengjincao)-bridge\?[^\s)]+)\)/g;
    const routes = [];
    let match;
    while ((match = expression.exec(text))) {
      const parsed = route(match[1]);
      if (!parsed) throw new Error("题卡的原题链接无效，请在对应插件中修复已导入题卡");
      routes.push(parsed);
    }
    if (!routes.length) throw new Error("这张卡片没有有效原题链接；导入题卡可在对应插件中修复后重试");
    const target = routes[0];
    if (routes.some(function (item) { return item.url !== target.url; })) throw new Error("题卡包含多个不同的原题链接，请先确认题目来源");
    // 已有导入身份必须与链接一致，避免个人评论中的另一道题被误当作本题。
    const markers = /<!--\s*(DAGUANYUAN_(?:408_)?(?:QUESTION|ANSWER)_ID|YANKEAN_(?:PAPER_)?(?:QUESTION|ANSWER)(?:_ID)?|JFJC_(?:QUESTION|ANSWER|SOURCE)):([^\s]+)\s*-->/g;
    while ((match = markers.exec(text))) {
      const name = match[1], identity = match[2];
      let expected;
      if (name.indexOf("DAGUANYUAN_") === 0) expected = target.provider === "daguanyuan" && (name.indexOf("408_") >= 0 ? "408" : "math") === target.source && Number(identity) === target.questionId;
      else if (name.indexOf("JFJC_") === 0) expected = target.provider === "jifengjincao" && identity === `${target.paperId}:${target.questionId}`;
      else {
        const parts = /^(?:(MATH|CSE408|NAISHUA|MOCK):)?([1-9]\d*)$/.exec(identity);
        expected = target.provider === "yankean" && parts && (parts[1] ? parts[1].toLowerCase() : "math") === target.source && Number(parts[2]) === target.questionId;
      }
      if (!expected) throw new Error("题卡身份与原题链接不一致，请在对应插件中修复后重试");
    }
    return target;
  }

  function selected(addon) {
    const app = Application.sharedInstance();
    const active = value(app, "focusWindow");
    if (active && active !== addon.window) throw new Error("请在当前学习窗口中查看原题");
    const study = app.studyController(addon.window), notebook = value(study, "notebookController");
    const entries = items(value(value(notebook, "mindmapView"), "selViewLst"));
    if (entries.length > 1) throw new Error("请只选中一张题卡");
    // 直接使用导航识别后的笔记，不能再次用较窄的属性检查丢弃原生焦点对象。
    const focus = __FOCUS_NEXT_CORE_GLOBAL__.navigationFocus(addon);
    const note = entries.length ? noteFrom(entries[0]) : focus;
    const notebookId = String(value(notebook, "notebookId") || "");
    if (note && value(note, "notebookId") && String(value(note, "notebookId")) !== notebookId) throw new Error("学习集已切换，请重新选中题卡");
    return { note, notebookId, selected: entries.length > 0, focusId: __FOCUS_NEXT_CORE_GLOBAL__.noteId(focus) };
  }

  function clear(addon) { if (addon) addon.__focusNextSourcePress = null; }

  function enabled(ai) { return ai ? __FOCUS_NEXT_CORE_GLOBAL__.aiEnabled() : __FOCUS_NEXT_CORE_GLOBAL__.sourceEnabled(); }

  function press(addon, ai) {
    clear(addon);
    if (addon.focusNextEnabled === false || !enabled(ai)) return;
    try {
      const current = selected(addon);
      if (current.note) addon.__focusNextSourcePress = { ai: Boolean(ai), note: current.note, notebookId: current.notebookId, selected: current.selected, focusId: current.focusId, at: Date.now() };
    } catch (ignored) {}
  }

  function open(addon, ai) {
    const pressed = addon.__focusNextSourcePress;
    clear(addon);
    if (addon.focusNextEnabled === false || !enabled(ai)) return false;
    if (pressed && pressed.ai !== Boolean(ai)) throw new Error("操作已变化，请重新点击");
    const current = selected(addon);
    if (pressed && pressed.notebookId !== current.notebookId) throw new Error("学习集已切换，请重新选中题卡或进入焦点");
    // 点击浮动按钮可能清空选中项，只保留本次按下至松手的短暂操作上下文。
    const elapsed = pressed ? Date.now() - pressed.at : -1;
    const validPress = pressed && elapsed >= 0 && elapsed <= 800 && pressed.notebookId === current.notebookId;
    let note = current.note;
    if (validPress && pressed.selected && !current.selected && current.focusId === pressed.focusId) note = pressed.note;
    if (pressed && note && __FOCUS_NEXT_CORE_GLOBAL__.noteId(pressed.note) !== __FOCUS_NEXT_CORE_GLOBAL__.noteId(note)) throw new Error("选中题卡已变化，请重新点击查看原题");
    if (!note && validPress) note = pressed.note;
    if (!note) {
      // 测试阶段临时诊断，只在失败时显示，不记录题目内容或笔记 ID。
      const memory = addon.__focusNextLastFocus ? "有" : "无";
      const notebook = current.notebookId ? "有" : "无";
      throw new Error(`请先选中一张导入题卡，或进入题卡焦点\n[DEBUG-F3] 焦点检查3：记忆${memory}，学习集ID${notebook}`);
    }
    const target = sourceFor(note), app = Application.sharedInstance();
    if (typeof app.openURL !== "function" || typeof NSURL === "undefined" || typeof NSURL.URLWithString !== "function") throw new Error("当前 MarginNote 版本不支持打开原题链接");
    if (ai && target.provider !== "daguanyuan" && target.provider !== "jifengjincao") throw new Error("这张题卡的来源暂不支持问 AI");
    const address = NSURL.URLWithString(ai ? target.url.replace("?action=open&", "?action=ask-ai&") : target.url);
    if (!address) throw new Error("原题链接无法打开");
    app.openURL(address);
    return target;
  }

  function foldBoundary(note) {
    let target;
    try { target = sourceFor(note); } catch (ignored) { return null; }
    const comments = items(value(note, "comments"));
    const link = `[查看原题](${target.url})`;
    for (let index = 0; index < comments.length; index += 1) {
      if (String(value(comments[index], "text") || "").indexOf(link) >= 0) return { index: index + 1, count: comments.length, url: target.url };
    }
    return null;
  }

  return { sourceFor, foldBoundary, press, open, clear };
})();
