var __FOCUS_NEXT_COMMENTS_GLOBAL__ = (function () {
  function value(object, key) {
    try {
      let result = object && object[key];
      if (result === undefined && object && typeof object.objectForKey === "function") result = object.objectForKey(key);
      return typeof result === "function" ? result.call(object) : result;
    } catch (ignored) { return undefined; }
  }

  function context(addon) {
    const app = Application.sharedInstance();
    const active = value(app, "focusWindow");
    if (active && active !== addon.window) throw new Error("请在当前学习窗口中操作评论");
    const study = app.studyController(addon.window);
    const notebook = value(study, "notebookController");
    const notebookId = String(value(notebook, "notebookId") || "");
    if (!notebookId) throw new Error("无法确认当前学习集，请重新打开学习集后重试");
    return { notebook, notebookId };
  }

  function selection(addon) {
    const current = context(addon), core = __FOCUS_NEXT_CORE_GLOBAL__;
    const entries = value(value(current.notebook, "mindmapView"), "selViewLst");
    const count = Number(value(entries, "count") === undefined ? value(entries, "length") || 0 : value(entries, "count"));
    if (!Number.isSafeInteger(count) || count < 0) throw new Error("无法读取选中卡片，请重新选择");
    const notes = [];
    for (let index = 0; index < count; index += 1) {
      let note = typeof entries.objectAtIndex === "function" ? entries.objectAtIndex(index) : entries[index];
      for (let depth = 0; note && depth < 3 && !core.noteId(note); depth += 1) note = value(note, "note");
      if (!note || !core.noteId(note)) throw new Error("部分选中卡片无法识别，请重新选择");
      notes.push(note);
    }
    const focus = core.navigationFocus(addon);
    if (!count && focus) notes.push(focus);
    const ids = [];
    notes.forEach(function (note) {
      const owner = String(value(note, "notebookId") || "");
      if (owner && owner !== current.notebookId) throw new Error("学习集已切换，请重新选择卡片");
      const id = core.noteId(note);
      if (id && ids.indexOf(id) < 0) ids.push(id);
    });
    return { ids, notebookId: current.notebookId, selected: count > 0, focusId: core.noteId(focus), at: Date.now() };
  }

  function clearPress(addon) { if (addon) addon.__focusNextCommentsPress = null; }

  function press(addon) {
    clearPress(addon);
    if (addon.focusNextEnabled === false) return;
    try { addon.__focusNextCommentsPress = selection(addon); } catch (ignored) {}
  }

  function cancel(addon) {
    if (!addon) return;
    clearPress(addon);
    const request = addon.__focusNextCommentsRequest;
    addon.__focusNextCommentsRequest = null;
    if (request && request.timer && typeof request.timer.invalidate === "function") request.timer.invalidate();
  }

  function active(addon, requestId) {
    const request = addon.__focusNextCommentsRequest;
    if (!request || request.id !== requestId || addon.focusNextEnabled === false) return false;
    if (!(request.collapsed ? __FOCUS_NEXT_CORE_GLOBAL__.collapseCommentsEnabled() : __FOCUS_NEXT_CORE_GLOBAL__.expandCommentsEnabled())) return false;
    try { return context(addon).notebookId === request.notebookId; } catch (ignored) { return false; }
  }

  function receipt(result, id) {
    if (!result || result.ok !== true) {
      throw __FOCUS_NEXT_COMMENT_DIAGNOSTICS_GLOBAL__.failure(result && result.error);
    }
    if (result.noteid !== id || typeof result.revision !== "string" || !result.revision || !Array.isArray(result.comments) ||
      result.comments.some(function (comment, index) { return !comment || comment.index !== index + 1 || typeof comment.collapsed !== "boolean"; })) {
      throw new Error("COMMENT_STATE_UNSUPPORTED：评论状态回执不完整，已停止操作");
    }
    return result;
  }

  function databaseNote(id) {
    const database = typeof Database !== "undefined" && typeof Database.sharedInstance === "function" && Database.sharedInstance();
    if (!database || typeof database.getNoteById !== "function") throw new Error("当前宿主未提供卡片读取接口");
    const note = database.getNoteById(id);
    if (!note) throw new Error("NOTE_NOT_FOUND：卡片已不存在，请重新选择");
    if (typeof note.commentState !== "function" || typeof note.setCommentsCollapsed !== "function") {
      throw new Error("当前宿主未提供 commentState / setCommentsCollapsed 原生评论接口");
    }
    return note;
  }

  function read(note, id) {
    let result;
    try { result = note.commentState(); }
    catch (error) { throw __FOCUS_NEXT_COMMENT_DIAGNOSTICS_GLOBAL__.failure(error); }
    return receipt(result, id);
  }

  function hasMainExcerpt(note) {
    const text = value(note, "excerptText");
    if (typeof text === "string" && text.trim()) return true;
    const picture = value(note, "excerptPic");
    if (!picture || typeof picture !== "object") return false;
    // 图片摘录可能是原生字典或普通对象，空字典不算正文内容。
    const count = value(picture, "count");
    if (Number.isSafeInteger(count) && count >= 0) return count > 0;
    return Object.keys(picture).length > 0;
  }

  function write(work, targets, collapsed) {
    // 原生入口自行完成保存、撤销与刷新，不额外保存数据库或包装撤销组。
    let result;
    try {
      let raw;
      try { raw = work.note.setCommentsCollapsed(targets.map(function (index) { return { index }; }), collapsed, work.state.revision); }
      catch (error) { throw __FOCUS_NEXT_COMMENT_DIAGNOSTICS_GLOBAL__.failure(error); }
      result = receipt(raw, work.id);
      if (result.persisted !== true || result.collapsed !== collapsed || result.requestedCount !== targets.length ||
        !Number.isSafeInteger(result.changedCount) || result.changedCount < 0 || result.changedCount > targets.length ||
        !Array.isArray(result.affectedOwnerNoteIds) || result.affectedOwnerNoteIds.some(function (id) { return typeof id !== "string" || !id; }) ||
        result.comments.length !== work.state.comments.length || targets.some(function (index) { return result.comments[index - 1].collapsed !== collapsed; })) {
        throw new Error("COMMENT_NOT_PERSISTED：宿主未确认评论状态已保存，请检查卡片后重试");
      }
    } catch (error) {
      // 失败只回读，不自动重试写入，也不假定宿主已经完成回滚。
      try { read(work.note, work.id); } catch (ignored) {}
      throw error;
    }
    return result;
  }

  function foldRule(note, state) {
    const boundary = __FOCUS_NEXT_SOURCE_GLOBAL__.foldBoundary(note);
    if (boundary) {
      if (boundary.count !== state.comments.length || boundary.index > state.comments.length) throw new Error("COMMENT_CHANGED：评论已变化，请重新点击后重试");
      return { imported: true, start: boundary.index, key: `source:${boundary.index}:${boundary.url}` };
    }
    const keep = hasMainExcerpt(note) ? 0 : 1;
    return { imported: false, start: keep + 1, key: `body:${keep}` };
  }

  function targetState(work, index) {
    if (!work.collapsed) return false;
    if (work.rule.imported && index < work.rule.start) return null;
    return index >= work.rule.start;
  }

  function finish(addon, request, error) {
    if (addon.__focusNextCommentsRequest !== request) return;
    cancel(addon);
    if (error) { __FOCUS_NEXT_COMMENT_DIAGNOSTICS_GLOBAL__.show(addon, request, error); return; }
    const verb = request.collapsed ? "折叠" : "展开";
    const suffix = request.usedSourceRule ? (request.usedBodyRule ? "，按各卡片规则保留正文" : "，保留原题链接上方内容") : "，保留正文第一项";
    const message = `已${verb} ${request.completed} 张卡片的评论${request.collapsed ? suffix : ""}`;
    __FOCUS_NEXT_CORE_GLOBAL__.showMessage(addon, message);
  }

  function step(addon, request) {
    if (!active(addon, request.id)) {
      if (addon.__focusNextCommentsRequest === request) cancel(addon);
      return;
    }
    try {
      if (!request.work) {
        request.stage = "首次读取";
        const id = request.ids[request.completed], note = databaseNote(id);
        request.currentNote = note;
        const state = read(note, id);
        // 三插件题卡从原题链接所在评论起折叠，上方评论不写入；其余卡片沿用首项规则。
        const rule = request.collapsed ? foldRule(note, state) : null;
        const work = { id, note, state, rule, collapsed: request.collapsed };
        if (rule && rule.imported) request.usedSourceRule = true;
        else if (rule) request.usedBodyRule = true;
        work.remaining = state.comments.filter(function (comment) {
          const target = targetState(work, comment.index);
          return target !== null && comment.collapsed !== target;
        }).map(function (comment) { return comment.index; });
        request.work = work;
      }
      const work = request.work;
      if (work.remaining.length) {
        const target = targetState(work, work.remaining[0]);
        const indices = work.remaining.filter(function (index) { return targetState(work, index) === target; }).slice(0, 200);
        request.stage = "写前读取";
        const latest = read(work.note, work.id);
        if (latest.revision !== work.state.revision) throw new Error("COMMENT_CHANGED：评论已变化，请重新点击后重试");
        if (request.collapsed) {
          const currentRule = foldRule(work.note, latest);
          if (currentRule.key !== work.rule.key) throw new Error(work.rule.imported || currentRule.imported
            ? "COMMENT_CHANGED：折叠起点或题目来源已变化，请重新点击后重试"
            : "COMMENT_CHANGED：主摘录已变化，请重新点击后重试");
        }
        if (!active(addon, request.id)) { if (addon.__focusNextCommentsRequest === request) cancel(addon); return; }
        request.stage = "写入";
        const result = write(work, indices, target);
        request.stage = "写后回读";
        const saved = read(work.note, work.id);
        if (saved.revision !== result.revision || saved.comments.length !== result.comments.length) throw new Error("COMMENT_CHANGED：评论已变化，请重新点击后重试");
        if (saved.comments.some(function (comment, index) { return comment.collapsed !== result.comments[index].collapsed; })) {
          throw new Error("COMMENT_NOT_PERSISTED：评论状态回读不一致，请检查卡片后重试");
        }
        work.state = saved;
        work.remaining = work.remaining.filter(function (index) { return indices.indexOf(index) < 0; });
      }
      if (!work.remaining.length) { request.completed += 1; request.work = null; request.currentNote = null; }
      if (!active(addon, request.id)) { if (addon.__focusNextCommentsRequest === request) cancel(addon); return; }
      if (request.completed === request.ids.length) { finish(addon, request); return; }
      schedule(addon, request);
    } catch (error) { finish(addon, request, error); }
  }

  function schedule(addon, request) {
    // 每批在主线程的定时回调中处理，批次之间允许关闭开关或切换学习集。
    request.timer = NSTimer.scheduledTimerWithTimeInterval(0.01, false, function () { step(addon, request); });
  }

  function run(addon, collapsed) {
    const pressed = addon.__focusNextCommentsPress;
    clearPress(addon);
    if (addon.focusNextEnabled === false) return false;
    if (!(collapsed ? __FOCUS_NEXT_CORE_GLOBAL__.collapseCommentsEnabled() : __FOCUS_NEXT_CORE_GLOBAL__.expandCommentsEnabled())) return false;
    if (addon.__focusNextCommentsRequest) throw new Error("评论正在处理中，请稍候");
    let current = selection(addon);
    if (pressed) {
      if (pressed.notebookId !== current.notebookId) throw new Error("学习集已切换，请重新选择卡片");
      const elapsed = Date.now() - pressed.at;
      if (elapsed < 0 || elapsed > 800) throw new Error("操作已超时，请重新点击评论按钮");
      // 浮动按钮可能清空多选，只在本次按下到松手期间保留选中的卡片。
      if (pressed.selected && !current.selected && pressed.focusId === current.focusId) current = pressed;
      if (pressed.ids.slice().sort().join("\n") !== current.ids.slice().sort().join("\n")) throw new Error("选中卡片已变化，请重新点击评论按钮");
    }
    if (!current.ids.length) throw new Error("请先选中一张或多张卡片，或进入卡片焦点");
    if (typeof NSTimer === "undefined" || typeof NSTimer.scheduledTimerWithTimeInterval !== "function") throw new Error("当前宿主无法调度评论操作");
    const id = Number(addon.__focusNextCommentsToken || 0) + 1;
    addon.__focusNextCommentsToken = id;
    addon.__focusNextCommentDiagnostic = null;
    const request = { id, ids: current.ids, notebookId: current.notebookId, collapsed: Boolean(collapsed), completed: 0, work: null, currentNote: null, stage: "等待执行" };
    addon.__focusNextCommentsRequest = request;
    try { schedule(addon, request); }
    catch (error) { cancel(addon); throw error; }
    return true;
  }

  function perform(addon, collapsed) {
    if (addon.__focusNextSuppressTap) { addon.__focusNextSuppressTap = false; clearPress(addon); return; }
    try { return run(addon, collapsed); }
    catch (error) {
      __FOCUS_NEXT_CORE_GLOBAL__.showMessage(addon, String(error && error.message || error));
      console.log(`[Focus Switch] 评论操作失败：${error && error.message || error}`);
    }
  }

  return { press, perform, cancel, clearPress, active };
})();
