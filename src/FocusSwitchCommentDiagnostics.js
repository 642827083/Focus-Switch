var __FOCUS_NEXT_COMMENT_DIAGNOSTICS_GLOBAL__ = (function () {
  // 临时诊断：仅提取白名单结构字段，不序列化宿主原始回执或评论内容。
  const PREFIX = "[DEBUG-CF1]";
  const CODES = ["COMMENT_STATE_UNSUPPORTED", "COMMENT_CHANGED", "COMMENT_NOT_PERSISTED", "SAVE_FAILED", "NOTE_NOT_FOUND", "INVALID_INPUT", "COMMENT_OWNER_UNAVAILABLE", "COMMENT_ID_AMBIGUOUS", "MAIN_THREAD_REQUIRED"];
  const TYPES = ["string", "number", "boolean", "object", "array", "null", "undefined", "TextNote", "PaintNote", "ImageNote", "DrawingNote", "LinkNote", "HtmlNote"];
  function get(object, key) {
    try {
      if (!object) return undefined;
      const item = object[key];
      return item === undefined && typeof object.objectForKey === "function" ? object.objectForKey(key) : item;
    } catch (ignored) { return undefined; }
  }
  function type(item) { return item === null ? "null" : Array.isArray(item) ? "array" : typeof item; }
  function details(raw) {
    const result = [], seen = [];
    const numeric = ["index", "commentIndex", "commentNumber", "metadataVersion", "version", "formatVersion", "supportedVersion", "expectedVersion", "actualVersion", "count"];
    const kinds = ["type", "commentType", "actualType", "expectedType", "metadataType", "kind"];
    function scan(object, prefix, depth) {
      if (!object || typeof object !== "object" || seen.indexOf(object) >= 0 || depth > 2 || result.length >= 12) return;
      seen.push(object);
      numeric.concat(kinds, ["field", "path"]).forEach(function (key) {
        if (result.length >= 12) return;
        const item = get(object, key);
        if (item === undefined) return;
        let safe;
        if (numeric.indexOf(key) >= 0 && (Number.isSafeInteger(item) && item >= 0 && item <= 1000000 || typeof item === "string" && /^\d{1,6}(?:\.\d{1,6}){0,2}$/.test(item))) safe = String(item);
        else if (kinds.indexOf(key) >= 0 && TYPES.indexOf(item) >= 0) safe = item;
        else if ((key === "field" || key === "path") && typeof item === "string" && item.length <= 100 && /^(?:comments?|Comment|metadata|version|type|index|collapsed|revision|ownerNoteId|commentId)(?:\[\d{1,6}\])?(?:\.(?:comments?|metadata|version|type|index|collapsed|revision|ownerNoteId|commentId)(?:\[\d{1,6}\])?)*$/.test(item)) safe = item;
        result.push(prefix + key + "=" + (safe === undefined ? "已省略(" + type(item) + ")" : safe));
      });
      ["metadata", "comment", "actual", "expected", "details"].forEach(function (key) { scan(get(object, key), prefix + key + ".", depth + 1); });
    }
    scan(raw, "", 0);
    return result.length ? result : [raw === undefined || raw === null ? "宿主未提供详情" : "详情无可公开结构字段(" + type(raw) + ")"];
  }
  function failure(raw) {
    const code = get(raw, "code");
    const safeCode = CODES.indexOf(code) >= 0 ? code : "COMMENT_STATE_UNSUPPORTED";
    const error = new Error(safeCode + "：宿主未能处理评论状态，已停止操作");
    error.code = safeCode;
    error.safeDetails = details(get(raw, "details"));
    return error;
  }
  function summary(note) {
    function member(object, key) {
      const item = get(object, key);
      try { return typeof item === "function" ? item.call(object) : item; } catch (ignored) { return undefined; }
    }
    const comments = member(note, "comments"), nativeCount = member(comments, "count");
    const count = Number(nativeCount === undefined ? member(comments, "length") : nativeCount);
    if (!Number.isSafeInteger(count) || count < 0 || count > 10000) return "评论结构无法读取";
    const counts = {};
    for (let index = 0; index < count; index += 1) {
      let comment;
      try { comment = typeof comments.objectAtIndex === "function" ? comments.objectAtIndex(index) : comments[index]; } catch (ignored) {}
      const kind = member(comment, "type");
      const key = TYPES.indexOf(kind) >= 0 ? kind : "其他(" + type(kind) + ")";
      counts[key] = (counts[key] || 0) + 1;
    }
    return "评论数=" + count + "；" + Object.keys(counts).map(function (key) { return key + "=" + counts[key]; }).join("，");
  }
  function show(addon, request, error) {
    const localMessages = [
      "COMMENT_STATE_UNSUPPORTED：评论状态回执不完整，已停止操作",
      "当前宿主未提供卡片读取接口", "NOTE_NOT_FOUND：卡片已不存在，请重新选择",
      "当前宿主未提供 commentState / setCommentsCollapsed 原生评论接口",
      "COMMENT_NOT_PERSISTED：宿主未确认评论状态已保存，请检查卡片后重试",
      "COMMENT_CHANGED：评论已变化，请重新点击后重试", "COMMENT_CHANGED：主摘录已变化，请重新点击后重试",
      "COMMENT_CHANGED：折叠起点或题目来源已变化，请重新点击后重试",
      "COMMENT_NOT_PERSISTED：评论状态回读不一致，请检查卡片后重试"
    ];
    // 未识别的宿主异常也可能带入正文，不能直接进入日志或弹窗。
    if (!error.safeDetails && localMessages.indexOf(error.message) < 0) error = failure(error);
    const heading = PREFIX + " " + (request.collapsed ? "折叠" : "展开") + "；阶段=" + request.stage + "；卡片=" + (request.completed + 1) + "/" + request.ids.length;
    const report = heading + "\n已处理 " + request.completed + "/" + request.ids.length + " 张卡片；" + String(error.message || "评论操作失败")
      + "\n" + summary(request.currentNote) + "\n" + (error.safeDetails || ["宿主未提供详情"]).join("；");
    addon.__focusNextCommentDiagnostic = report;
    console.log(report);
    try {
      const app = Application.sharedInstance();
      if (typeof app.alert === "function") app.alert(report);
      else app.showHUD(report, addon.window, 12);
    }
    catch (ignored) { __FOCUS_NEXT_CORE_GLOBAL__.showMessage(addon, report); }
  }
  return { failure, show };
})();
