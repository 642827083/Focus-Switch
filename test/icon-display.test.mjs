import test from "node:test";
import assert from "node:assert/strict";
import { runtime } from "./helpers/focus-runtime.mjs";

const definitions = [
  ["__focusPreviousButton", "arrow-up", "上一张", "handleFocusPreviousButtonPan", "previous-button-position"],
  ["__focusNextButton", "arrow-down", "下一张", "handleFocusNextButtonPan", "next-button-position"],
  ["__focusSourceButton", "zoom-scan", "查看原题", "handleFocusSourceButtonPan", "source-button-position"],
  ["__focusCollapseCommentsButton", "fold-vertical", "折叠评论", "handleFocusCollapseCommentsPan", "collapse-comments-button-position"],
  ["__focusExpandCommentsButton", "unfold-vertical", "展开评论", "handleFocusExpandCommentsPan", "expand-comments-button-position"],
];

test("图标模式默认关闭，开关即时更新五个按钮、面板并记忆，关闭可恢复文字", () => {
  const defaults = {};
  const run = runtime(defaults);
  run.addon.notebookWillOpen(); run.addon.setSourceEnabled({ on: true });
  for (const [property, , title] of definitions) assert.equal(run.addon[property].title, title);
  run.addon.focusToolbarClick(); run.advance(300);
  const row = run.addon.__focusNextSettings.rows.find(row => row.key === "iconDisplay");
  assert.equal(row.control.selectedSegmentIndex, 0);
  assert.equal(row.control.selector, "setButtonStyle:");
  run.addon.setButtonStyle({ selectedSegmentIndex: 1 });
  assert.equal(row.control.selectedSegmentIndex, 1);
  assert.equal(defaults["cn.marginnote.focus-next.icon-display"], true);
  for (const [property, icon] of definitions) {
    const button = run.addon[property];
    assert.equal(button.image.resourcePath, `button-icons/${icon}.png`);
    assert.deepEqual(button.image.size, { width: 24, height: 24 });
    assert.equal(button.title, "");
    assert.equal(button.frame.width, 36);
    assert.equal(button.frame.height, 36);
    assert.equal(button.superview, run.controller.view);
  }
  const restarted = runtime(defaults);
  restarted.addon.notebookWillOpen();
  for (const [property, icon] of definitions) assert.equal(restarted.addon[property].image.resourcePath, `button-icons/${icon}.png`);
  run.addon.setButtonStyle({ selectedSegmentIndex: 0 });
  assert.equal(row.control.selectedSegmentIndex, 0);
  for (const [property, , title] of definitions) {
    assert.equal(run.addon[property].image, null);
    assert.equal(run.addon[property].title, title);
    assert.equal(run.addon[property].frame.width, 76);
    assert.equal(run.addon[property].frame.height, 36);
  }
});

test("旧版本曾开启序号也只显示固定按钮，切卡、重启及切换模式不会恢复数字", () => {
  for (const grouped of [false, true]) for (const horizontal of [false, true]) {
    const defaults = { "cn.marginnote.focus-next.ordinal-enabled": true };
    const run = runtime(defaults);
    run.addon.setSourceEnabled({ on: true }); run.addon.setIconDisplay({ on: true });
    run.addon.setGroupDirection({ selectedSegmentIndex: horizontal ? 1 : 0 });
    run.addon.setGroupedDisplay({ on: grouped });
    run.addon.focusNext(); run.advance(200); run.addon.focusPrevious(); run.advance(200);
    for (const [property] of definitions) {
      assert.equal(run.addon[property].title, "");
      assert.equal(run.addon[property].frame.width, 36);
      assert.equal(run.addon[property].frame.height, 36);
    }
    run.addon.focusToolbarClick(); run.advance(300);
    assert.equal(run.addon.__focusNextSettings.rows.some(row => row.title.text === "显示卡片序号"), false);
    const restarted = runtime(defaults); restarted.addon.notebookWillOpen();
    assert.equal(restarted.addon.__focusNextButton.title, "");
    assert.equal(restarted.addon.__focusNextButton.frame.width, 36);
    run.addon.setIconDisplay({ on: false });
    assert.equal(run.addon.__focusPreviousButton.title, "上一张");
    assert.equal(run.addon.__focusNextButton.title, "下一张");
  }
});

test("图标按钮独立拖动，模式切换与重启不改写或丢失位置记忆", () => {
  const defaults = {};
  const run = runtime(defaults);
  run.addon.setSourceEnabled({ on: true }); run.addon.setIconDisplay({ on: true });
  for (const [property, , , handler, key] of definitions) {
    const button = run.addon[property];
    run.addon[handler]({ state: 1 });
    run.addon[handler]({ state: 2, translationInView() { return { x: -80, y: -30 }; }, setTranslationInView() {} });
    run.addon[handler]({ state: 3 });
    const stored = defaults[`cn.marginnote.focus-next.${key}`];
    const before = { ...button.frame };
    run.addon.controllerWillLayoutSubviews(); run.advance(200);
    for (const axis of ["x", "y"]) assert.ok(Math.abs(button.frame[axis] - before[axis]) < 0.001);
    run.addon.setIconDisplay({ on: false });
    assert.equal(defaults[`cn.marginnote.focus-next.${key}`], stored);
    run.addon.setIconDisplay({ on: true });
    for (const axis of ["x", "y"]) assert.ok(Math.abs(button.frame[axis] - before[axis]) < 0.001);
  }
  const restarted = runtime(defaults); restarted.addon.notebookWillOpen();
  for (const [property] of definitions) {
    const before = run.addon[property].frame, after = restarted.addon[property].frame;
    for (const axis of ["x", "y"]) assert.ok(Math.abs(after[axis] - before[axis]) < 0.001);
  }
});

test("图标模式在小窗口完整显示右侧四个按钮，窗口缩放后仍在可见范围内", () => {
  const run = runtime({}, 300, 200);
  run.addon.setSourceEnabled({ on: true }); run.addon.setIconDisplay({ on: true });
  const right = definitions.slice(1).map(([property]) => run.addon[property]);
  for (let index = 1; index < right.length; index++) assert.ok(right[index].frame.y >= right[index - 1].frame.y + 36);
  assert.ok(right.at(-1).frame.y + 36 <= 200);
  for (const [width, height] of [[250, 250], [1024, 768], [300, 200]]) {
    run.controller.view.frame = { x: 0, y: 0, width, height }; run.advance(200);
    for (const [property] of definitions) {
      const frame = run.addon[property].frame;
      assert.ok(frame.x >= 0 && frame.y >= 0);
      assert.ok(frame.x + frame.width <= width && frame.y + frame.height <= height);
    }
  }
});

test("图标开关服从总开关和各显示开关，重新开启时沿用图标选择", () => {
  const run = runtime();
  run.addon.setFocusEnabled({ on: false }); run.addon.setIconDisplay({ on: true });
  assert.equal(run.addon.__focusNextButton, undefined);
  run.addon.setFocusEnabled({ on: true });
  assert.ok(run.addon.__focusNextButton.image);
  assert.equal(run.addon.__focusSourceButton, undefined);
  for (const [method, property] of [["setPreviousEnabled", "__focusPreviousButton"], ["setCollapseCommentsEnabled", "__focusCollapseCommentsButton"], ["setExpandCommentsEnabled", "__focusExpandCommentsButton"]]) {
    run.addon[method]({ on: false });
    assert.equal(run.addon[property].superview, undefined);
    run.addon[method]({ on: true });
    assert.ok(run.addon[property].image);
    assert.equal(run.addon[property].superview, run.controller.view);
  }
  run.addon.setSourceEnabled({ on: true });
  assert.ok(run.addon.__focusSourceButton.image);
  run.addon.setFocusEnabled({ on: false });
  for (const [property] of definitions) assert.equal(run.addon[property].superview, undefined);
});

test("原生图片接口不可用或个别资源缺失时仍有文字按钮可操作", () => {
  for (const failure of ["api", "resource"]) {
    const run = runtime();
    if (failure === "api") run.context.UIImage = undefined;
    else {
      const read = run.context.NSData.dataWithContentsOfFile;
      run.context.NSData.dataWithContentsOfFile = path => path.endsWith("zoom-scan.png") ? null : read(path);
    }
    run.addon.setSourceEnabled({ on: true }); run.addon.setIconDisplay({ on: true });
    assert.equal(run.addon.__focusSourceButton.title, "查看原题");
    assert.equal(run.addon.__focusSourceButton.frame.width, 76);
    if (failure === "resource") assert.ok(run.addon.__focusNextButton.image);
    else assert.equal(run.addon.__focusNextButton.title, "下一张");
    run.addon.focusNext();
    assert.equal(run.controller.notebookController.focusNote, run.nodes.a2);
  }
});
