import test from "node:test";
import assert from "node:assert/strict";
import { runtime } from "./helpers/focus-runtime.mjs";

function comments(flags) {
  return flags.map((collapsed, index) => ({ index: index + 1, collapsed, type: index % 2 ? "PaintNote" : "TextNote", text: index % 2 ? "" : `评论${index + 1}` }));
}

function nativeHost(run, initial, options = {}) {
  const state = structuredClone(initial), writes = [], reads = [], revisions = {};
  const receipt = id => ({ ok: true, noteid: id, revision: String(revisions[id] || 1), comments: structuredClone(state[id]) });
  const notes = {};
  for (const id of Object.keys(state)) {
    revisions[id] = 1;
    notes[id] = {
      noteId: id,
      commentState() {
        reads.push(id);
        const override = options.before?.({ action: "read", id, state, writes, revisions, run });
        return override === undefined ? receipt(id) : override;
      },
      setCommentsCollapsed(targets, collapsed, revision) {
        assert.ok(targets.length > 0 && targets.length <= 200);
        assert.equal(typeof collapsed, "boolean");
        const override = options.before?.({ action: "write", id, targets, collapsed, revision, state, writes, revisions, run });
        if (override !== undefined) return override;
        if (revision !== String(revisions[id])) return { ok: false, error: { code: "COMMENT_CHANGED", message: "评论已经变化" } };
        writes.push({ id, targets: Array.from(targets, target => ({ ...target })), collapsed, revision });
        let changedCount = 0;
        for (const target of targets) {
          const comment = state[id].find(item => item.index === target.index);
          assert.ok(comment);
          if (comment.collapsed !== collapsed) changedCount += 1;
          comment.collapsed = collapsed;
        }
        revisions[id] += 1;
        const result = { ...receipt(id), persisted: true, collapsed, requestedCount: targets.length, changedCount, affectedOwnerNoteIds: changedCount ? [id] : [] };
        return options.afterWrite ? options.afterWrite(result) : result;
      },
    };
  }
  run.context.Database = { sharedInstance() { return { getNoteById(id) { return notes[id]; } }; } };
  // 用与故障设备相同的面板缺口验证：评论操作不能依赖面板方法。
  run.context.AddonWebPanel = { panel() { throw new Error("不应调用场景面板"); } };
  return { state, writes, reads, notes, drain() {
    for (let i = 0; i < 2000 && run.addon.__focusNextCommentsRequest; i += 1) run.advance(20);
    assert.ok(!run.addon.__focusNextCommentsRequest);
  } };
}

test("无场景面板方法也能通过原生接口折叠评论，保留第一条展开", () => {
  const run = runtime();
  const host = nativeHost(run, { a1: comments([true, false, false]) });
  run.addon.collapseComments(); host.drain();
  assert.deepEqual(host.state.a1.map(item => item.collapsed), [false, true, true]);
  assert.match(run.messages.at(-1), /已折叠 1 张/);
  run.addon.expandComments(); host.drain();
  assert.deepEqual(host.state.a1.map(item => item.collapsed), [false, false, false]);
});

test("文字、Markdown及图片主摘录保留，全部评论折叠且可重新展开", () => {
  for (const excerpt of [
    { excerptText: "主摘录" },
    { excerptText: "**主摘录**", excerptTextMarkdown: 1 },
    { excerptText: "", excerptPic: { hash: "excerpt-image" } },
    { excerptPic: { count() { return 1; } } },
  ]) {
    const run = runtime();
    const original = comments([false, true, false]);
    const host = nativeHost(run, { a1: original });
    Object.assign(host.notes.a1, excerpt);
    run.addon.collapseComments(); host.drain();
    assert.deepEqual(host.state.a1.map(item => item.collapsed), [true, true, true]);
    assert.match(run.messages.at(-1), /保留正文第一项/);
    for (const key of Object.keys(excerpt)) assert.equal(host.notes.a1[key], excerpt[key]);
    run.addon.expandComments(); host.drain();
    assert.deepEqual(host.state.a1.map(item => item.collapsed), [false, false, false]);
    assert.deepEqual(host.state.a1.map(({ collapsed, ...rest }) => rest), original.map(({ collapsed, ...rest }) => rest));
  }
});

test("标题和空摘录不计入正文，任意格式的第一条评论均保留展开", () => {
  for (const type of ["TextNote", "PaintNote", "AudioNote", "HtmlNote", "OtherNote"]) {
    for (const excerptPic of [undefined, null, {}, { count() { return 0; } }]) {
      const run = runtime();
      const initial = comments([true, false]);
      initial[0].type = type; initial[0].text = "";
      const host = nativeHost(run, { a1: initial });
      Object.assign(host.notes.a1, { noteTitle: "标题", excerptText: " \n\t", excerptPic });
      run.addon.collapseComments(); host.drain();
      assert.deepEqual(host.state.a1.map(item => item.collapsed), [false, true]);
    }
  }
});

test("多选混合摘录卡和评论卡时分别保留首项，一条评论及空卡同样适用", () => {
  const run = runtime();
  const host = nativeHost(run, { a: comments([false, false]), b: comments([true, false]), a2: comments([false]), b1: [] });
  host.notes.a.excerptText = "文字主摘录";
  host.notes.a2.excerptPic = { hash: "picture" };
  run.controller.notebookController.mindmapView.selViewLst = [run.nodes.a, run.nodes.b, run.nodes.a2, run.nodes.b1];
  run.addon.collapseComments(); host.drain();
  assert.deepEqual(host.state.a.map(item => item.collapsed), [true, true]);
  assert.deepEqual(host.state.b.map(item => item.collapsed), [false, true]);
  assert.deepEqual(host.state.a2.map(item => item.collapsed), [true]);
  assert.deepEqual(host.state.b1, []);
  assert.match(run.messages.at(-1), /已折叠 4 张/);
  run.addon.expandComments(); host.drain();
  for (const items of Object.values(host.state)) assert.ok(items.every(item => !item.collapsed));
});

test("有主摘录的大量评论从第一条开始全部分批折叠", () => {
  const run = runtime();
  const host = nativeHost(run, { a1: comments(Array(405).fill(false)) });
  host.notes.a1.excerptText = "主摘录";
  run.addon.collapseComments(); host.drain();
  assert.deepEqual(host.writes.map(write => write.targets.length), [200, 200, 5]);
  assert.ok(host.state.a1.every(item => item.collapsed));
});

test("批次之间新增或移除主摘录时停止，不继续使用旧的首项规则", () => {
  for (const hadExcerpt of [false, true]) {
    const run = runtime();
    const host = nativeHost(run, { a1: comments(Array(405).fill(false)) });
    host.notes.a1.excerptText = hadExcerpt ? "主摘录" : "";
    run.addon.collapseComments(); run.advance(10);
    assert.equal(host.writes.length, 1);
    host.notes.a1.excerptText = hadExcerpt ? "" : "新增主摘录";
    host.drain();
    assert.equal(host.writes.length, 1);
    assert.match(run.messages.at(-1), /COMMENT_CHANGED.*主摘录已变化/);
  }
});

test("原生多选去重并逐张处理，无评论和一条评论同样可折叠展开", () => {
  const run = runtime();
  const host = nativeHost(run, { a: comments([false, false, false]), b: [], a2: comments([true]) });
  const entries = [run.nodes.a, { note: run.nodes.b }, { note: run.nodes.a2 }, run.nodes.a];
  run.controller.notebookController.mindmapView.selViewLst = { count() { return entries.length; }, objectAtIndex(i) { return entries[i]; } };
  run.addon.collapseComments(); host.drain();
  assert.deepEqual(host.state.a.map(item => item.collapsed), [false, true, true]);
  assert.equal(host.state.a2[0].collapsed, false);
  assert.match(run.messages.at(-1), /已折叠 3 张/);
  run.addon.expandComments(); host.drain();
  assert.deepEqual(host.state.a.map(item => item.collapsed), [false, false, false]);
  assert.deepEqual(host.state.b, []);
  assert.match(run.messages.at(-1), /已展开 3 张/);
});

test("集中显示的文字或图标按钮在横竖排列下仍可对多张卡片折叠和展开", () => {
  for (const icons of [false, true]) for (const horizontal of [false, true]) {
    const run = runtime();
    const host = nativeHost(run, { a: comments([false, false]), b: comments([true, false]) });
    host.notes.a.excerptText = "保留的主摘录";
    run.addon.setIconDisplay({ on: icons });
    run.addon.setGroupDirection({ selectedSegmentIndex: horizontal ? 1 : 0 });
    run.addon.setGroupedDisplay({ on: true });
    run.controller.notebookController.mindmapView.selViewLst = [run.nodes.a, run.nodes.b];
    run.addon.pressComments(); run.addon.collapseComments(); host.drain();
    assert.deepEqual(host.state.a.map(item => item.collapsed), [true, true]);
    assert.deepEqual(host.state.b.map(item => item.collapsed), [false, true]);
    assert.equal(run.addon.__focusCollapseCommentsButton.superview, run.addon.__focusNextGroup.view);
    run.addon.pressComments(); run.addon.expandComments(); host.drain();
    for (const items of Object.values(host.state)) assert.ok(items.every(item => !item.collapsed));
  }
});

test("图片、手写、文本及历史无稳定ID评论仅改变折叠状态，不改正文和归属", () => {
  const run = runtime();
  const original = comments([false, false, false, false]);
  original[0].type = "PaintNote"; original[0].text = "";
  original[1].commentId = null; original[1].ownerNoteId = "original";
  original[2].type = "AudioNote";
  const host = nativeHost(run, { a1: original });
  run.addon.collapseComments(); host.drain();
  assert.deepEqual(host.writes[0].targets, [{ index: 2 }, { index: 3 }, { index: 4 }]);
  assert.deepEqual(host.state.a1.map(({ collapsed, ...rest }) => rest), original.map(({ collapsed, ...rest }) => rest));
  run.addon.collapseComments(); host.drain();
  assert.equal(host.writes.length, 1);
});

test("大量评论按200条分批，保留第一条且每批使用刚确认的版本", () => {
  const run = runtime();
  const host = nativeHost(run, { a1: comments(Array(405).fill(false)) });
  run.addon.collapseComments(); host.drain();
  assert.deepEqual(host.writes.map(write => write.targets.length), [200, 200, 4]);
  assert.deepEqual(host.writes.map(write => write.revision), ["1", "2", "3"]);
  assert.equal(host.state.a1[0].collapsed, false);
  assert.ok(host.state.a1.slice(1).every(item => item.collapsed));
});

test("按下后清空多选仍处理本次选卡，直接焦点处理不依赖面板", () => {
  const run = runtime();
  const host = nativeHost(run, { a: comments([false, false]), b: comments([false, false]) });
  run.controller.notebookController.mindmapView.selViewLst = [{ note: run.nodes.a }, { note: run.nodes.b }];
  run.addon.pressComments();
  run.controller.notebookController.mindmapView.selViewLst = [];
  run.addon.collapseComments(); host.drain();
  assert.deepEqual(host.writes.map(write => write.id), ["a", "b"]);
});

test("换卡、过期、跨学习集和无有效目标均不写入原生接口", () => {
  for (const mode of ["changed", "expired", "notebook", "empty", "invalid"]) {
    const run = runtime();
    const host = nativeHost(run, { a1: comments([false, false]) });
    if (mode === "empty") run.controller.notebookController.focusNote = undefined;
    else if (mode === "invalid") run.controller.notebookController.mindmapView.selViewLst = [{}];
    else {
      run.addon.pressComments();
      if (mode === "changed") run.controller.notebookController.focusNote = run.nodes.a2;
      if (mode === "expired") run.advance(801);
      if (mode === "notebook") run.controller.notebookController.notebookId = "another";
    }
    run.addon.collapseComments(); host.drain();
    assert.equal(host.writes.length, 0, mode);
    assert.ok(run.messages.length, mode);
  }
});

test("评论版本冲突保留原版本并停止，不用新版本强制覆盖", () => {
  const run = runtime();
  let reads = 0;
  const host = nativeHost(run, { a1: comments([false, false]) }, {
    before({ action, revisions }) { if (action === "read" && ++reads === 2) revisions.a1 += 1; },
  });
  run.addon.collapseComments(); host.drain();
  assert.equal(host.writes.length, 0);
  assert.match(run.messages.at(-1), /COMMENT_CHANGED/);
});

test("原生接口业务失败会保留错误码并报告已完成卡片数", () => {
  const run = runtime();
  const host = nativeHost(run, { a1: comments([false, false]), a2: comments([false, false]) }, {
    before({ action, id }) { if (action === "write" && id === "a2") return { ok: false, error: { code: "SAVE_FAILED", message: "保存失败模拟" } }; },
  });
  run.controller.notebookController.mindmapView.selViewLst = [run.nodes.a1, run.nodes.a2];
  run.addon.collapseComments(); host.drain();
  assert.equal(host.state.a1[1].collapsed, true);
  assert.equal(host.state.a2[1].collapsed, false);
  assert.match(run.messages.at(-1), /已处理 1\/2.*SAVE_FAILED/);
});

test("不完整保存回执不能视为成功，也不自动重试写入", () => {
  for (const field of ["ok", "persisted", "requestedCount", "changedCount", "collapsed", "affectedOwnerNoteIds", "noteid", "revision"]) {
    const run = runtime();
    const host = nativeHost(run, { a1: comments([false, false]) }, {
      afterWrite(result) { delete result[field]; return result; },
    });
    run.addon.collapseComments(); host.drain();
    assert.equal(host.writes.length, 1, field);
    assert.match(run.messages.at(-1), /已处理 0\/1/, field);
    assert.doesNotMatch(run.messages.at(-1), /已折叠/, field);
  }
});

test("原生写入宣称成功但重新读取未生效时报告失败", () => {
  const run = runtime();
  const host = nativeHost(run, { a1: comments([false, false]) }, {
    before({ action, id, targets, collapsed, revision, state }) {
      if (action !== "write") return;
      const projection = structuredClone(state[id]);
      for (const target of targets) projection[target.index - 1].collapsed = collapsed;
      return { ok: true, noteid: id, revision, comments: projection, persisted: true, collapsed,
        requestedCount: targets.length, changedCount: targets.length, affectedOwnerNoteIds: [id] };
    },
  });
  run.addon.collapseComments(); host.drain();
  assert.equal(host.state.a1[1].collapsed, false);
  assert.match(run.messages.at(-1), /COMMENT_NOT_PERSISTED.*回读不一致/);
});

test("批次之间外部改变评论时停止后续写入", () => {
  const run = runtime();
  const host = nativeHost(run, { a1: comments(Array(405).fill(false)) });
  run.addon.collapseComments(); run.advance(10);
  assert.equal(host.writes.length, 1);
  const raw = host.notes.a1.commentState;
  host.notes.a1.commentState = function () { const result = raw(); result.revision = "external"; return result; };
  host.drain();
  assert.equal(host.writes.length, 1);
  assert.match(run.messages.at(-1), /COMMENT_CHANGED/);
});

test("关闭总开关、对应子开关或离开场景可取消待执行批次", () => {
  for (const action of ["setFocusEnabled", "setCollapseCommentsEnabled", "notebookWillOpen", "notebookWillClose", "sceneWillResignActive", "sceneDidDisconnect"]) {
    const run = runtime();
    const host = nativeHost(run, { a1: comments(Array(405).fill(false)) });
    run.addon.collapseComments(); run.advance(10);
    assert.equal(host.writes.length, 1, action);
    run.addon[action]({ on: false }); host.drain(); run.advance(100);
    assert.equal(host.writes.length, 1, action);
  }
});

test("处理过程中离开学习集会在写入前中止", () => {
  const run = runtime();
  const host = nativeHost(run, { a1: comments([false, false]) }, {
    before({ action }) { if (action === "read") run.addon.notebookWillClose(); },
  });
  run.addon.collapseComments(); host.drain();
  assert.equal(host.writes.length, 0);
});

test("连续点击不会并发写入，取消后的旧定时回调不影响新操作", () => {
  const run = runtime();
  const host = nativeHost(run, { a1: comments([false, false]) });
  run.addon.collapseComments(); run.addon.expandComments();
  assert.match(run.messages.at(-1), /正在处理/);
  const stale = run.addon.__focusNextCommentsRequest.timer.callback;
  run.addon.setFocusEnabled({ on: false }); run.addon.setFocusEnabled({ on: true });
  run.addon.expandComments(); stale(); host.drain();
  assert.deepEqual(host.state.a1.map(item => item.collapsed), [false, false]);
  assert.equal(host.writes.length, 0);
});

test("缺少卡片原生方法会明确提示，不尝试调用场景面板", () => {
  const run = runtime();
  const host = nativeHost(run, { a1: comments([false, false]) });
  delete host.notes.a1.setCommentsCollapsed;
  run.addon.collapseComments(); host.drain();
  assert.match(run.messages.at(-1), /commentState.*setCommentsCollapsed/);
  assert.equal(host.writes.length, 0);
});

test("两个评论按钮的显示开关独立记忆，总开关保留子开关和位置", () => {
  const defaults = { "cn.marginnote.focus-next.collapse-comments-button-position": JSON.stringify({ xRatio: 0.3, yRatio: 0.4 }) };
  const run = runtime(defaults);
  run.addon.notebookWillOpen();
  run.addon.setCollapseCommentsEnabled({ on: false });
  assert.equal(run.addon.__focusCollapseCommentsButton.superview, undefined);
  assert.equal(run.addon.__focusExpandCommentsButton.superview, run.controller.view);
  run.addon.setExpandCommentsEnabled({ on: false }); run.addon.setCollapseCommentsEnabled({ on: true });
  assert.equal(run.addon.__focusExpandCommentsButton.superview, undefined);
  assert.ok(Math.abs(run.addon.__focusCollapseCommentsButton.frame.x - 0.3 * (1024 - 76)) < 0.0001);
  run.addon.setFocusEnabled({ on: false });
  const restarted = runtime(defaults);
  restarted.addon.setFocusEnabled({ on: true });
  assert.equal(restarted.addon.__focusCollapseCommentsButton.superview, restarted.controller.view);
  assert.equal(restarted.addon.__focusExpandCommentsButton, undefined);
});

test("关闭另一评论按钮的开关不取消当前任务，关闭对应开关后按钮不写入", () => {
  const run = runtime();
  const host = nativeHost(run, { a1: comments([false, false]) });
  run.addon.collapseComments(); run.addon.setExpandCommentsEnabled({ on: false }); host.drain();
  assert.equal(host.state.a1[1].collapsed, true);
  run.addon.expandComments(); host.drain();
  assert.equal(host.writes.length, 1);
});

test("评论按钮14点样式、独立拖动与小窗口布局保持一致", () => {
  const run = runtime();
  run.addon.notebookWillOpen();
  const host = nativeHost(run, { a1: comments([false, false]) });
  for (const [key, handler] of [["__focusCollapseCommentsButton", "handleFocusCollapseCommentsPan"], ["__focusExpandCommentsButton", "handleFocusExpandCommentsPan"]]) {
    const button = run.addon[key];
    assert.equal(button.titleLabel.font, 14); assert.equal(button.frame.height, 36);
    run.addon[handler]({ state: 1 });
    run.addon[handler]({ state: 2, translationInView() { return { x: -100, y: -100 }; }, setTranslationInView() {} });
    run.addon[handler]({ state: 3 });
    const position = { ...button.frame };
    run.addon.collapseComments(); run.addon.controllerWillLayoutSubviews();
    for (const field of ["x", "y"]) assert.ok(Math.abs(button.frame[field] - position[field]) < 0.001);
  }
  host.drain(); assert.equal(host.writes.length, 0);
  assert.ok(run.defaults["cn.marginnote.focus-next.collapse-comments-button-position"]);
  assert.ok(run.defaults["cn.marginnote.focus-next.expand-comments-button-position"]);
  const small = runtime({}, 300, 200);
  small.addon.notebookWillOpen(); small.addon.setSourceEnabled({ on: true });
  const buttons = [small.addon.__focusNextButton, small.addon.__focusSourceButton, small.addon.__focusCollapseCommentsButton, small.addon.__focusExpandCommentsButton];
  for (let i = 1; i < buttons.length; i++) assert.ok(buttons[i].frame.y >= buttons[i - 1].frame.y + 36);
  assert.ok(buttons.at(-1).frame.y + 36 <= 200);
});
