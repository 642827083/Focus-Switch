import test from "node:test";
import assert from "node:assert/strict";
import { runtime } from "./helpers/focus-runtime.mjs";

const properties = ["__focusPreviousButton", "__focusNextButton", "__focusSourceButton", "__focusCollapseCommentsButton", "__focusExpandCommentsButton"];
const handlers = ["handleFocusPreviousButtonPan", "handleFocusNextButtonPan", "handleFocusSourceButtonPan", "handleFocusCollapseCommentsPan", "handleFocusExpandCommentsPan"];
const keys = ["previous-button-position", "next-button-position", "source-button-position", "collapse-comments-button-position", "expand-comments-button-position"];
const prefix = "cn.marginnote.focus-next.";

function allButtons(run) { run.addon.notebookWillOpen(); run.addon.setSourceEnabled({ on: true }); }
function direction(run, horizontal) { run.addon.setGroupDirection({ selectedSegmentIndex: horizontal ? 1 : 0 }); }
function drag(run, handler, dx, dy, terminal = 3) {
  const recognizer = { state: 1, translationInView() { return { x: dx, y: dy }; }, setTranslationInView() {} };
  run.addon[handler](recognizer);
  recognizer.state = 2; run.addon[handler](recognizer);
  if (terminal !== null) { recognizer.state = terminal; run.addon[handler](recognizer); }
  return recognizer;
}
function closeFrame(actual, expected) {
  for (const key of ["x", "y", "width", "height"]) assert.ok(Math.abs(actual[key] - expected[key]) < 0.001, key);
}

test("显示设置位于面板上方，可直接选择竖横方向，集中显示默认关闭", () => {
  const run = runtime();
  allButtons(run); run.addon.focusToolbarClick(); run.advance(300);
  const menu = run.addon.__focusNextSettings;
  assert.deepEqual(Array.from(menu.rows.slice(0, 4), row => row.key), ["enabled", "iconDisplay", "groupedDisplay", "groupDirection"]);
  assert.equal(run.addon.__focusNextGroup, undefined);
  const control = menu.rows[3].control;
  assert.deepEqual(control.segments, ["竖向", "横向"]);
  assert.equal(control.selectedSegmentIndex, 0);
  assert.equal(control.selector, "setGroupDirection:");
  direction(run, true);
  assert.equal(control.selectedSegmentIndex, 1);
  assert.equal(run.addon.__focusNextGroup, undefined);
  run.addon.setGroupedDisplay({ on: true });
  const group = run.addon.__focusNextGroup;
  assert.equal(menu.rows[2].control.on, true);
  assert.equal(group.horizontal, true);
  assert.ok(run.controller.view.subviews.indexOf(group.view) < run.controller.view.subviews.indexOf(menu.panel));
  run.addon.setGroupDirection({ selectedSegmentIndex: -1 });
  assert.equal(group.horizontal, true);
});

test("文字和图标均可横向或竖向集中排列，每个功能仍直接显示", () => {
  for (const icons of [false, true]) for (const horizontal of [false, true]) {
    const run = runtime();
    allButtons(run); run.addon.setIconDisplay({ on: icons }); direction(run, horizontal); run.addon.setGroupedDisplay({ on: true });
    const group = run.addon.__focusNextGroup;
    assert.equal(group.view.superview, run.controller.view);
    assert.equal(group.entries.length, 5);
    for (let index = 0; index < properties.length; index++) {
      const button = run.addon[properties[index]];
      assert.equal(button.superview, group.view);
      assert.equal(button.hidden, false);
      assert.equal(Boolean(button.image), icons);
      if (icons) {
        assert.equal(button.frame.width, 36);
        assert.equal(button.frame.height, 36);
        assert.deepEqual(button.image.size, { width: 24, height: 24 });
      }
      if (index) {
        const previous = run.addon[properties[index - 1]].frame;
        if (horizontal) { assert.ok(button.frame.x >= previous.x + previous.width); assert.equal(button.frame.y, previous.y); }
        else { assert.ok(button.frame.y >= previous.y + previous.height); assert.equal(button.frame.x, previous.x); }
      }
    }
  }
});

test("拖动任意按钮只移动整组，关闭集中显示恢复独立位置及其原始设置", () => {
  const defaults = {};
  keys.forEach((key, index) => { defaults[prefix + key] = JSON.stringify({ xRatio: 0.15 + index * 0.1, yRatio: 0.1 + index * 0.1 }); });
  const stored = { ...defaults };
  const run = runtime(defaults); allButtons(run);
  const independent = properties.map(property => ({ ...run.addon[property].frame }));
  run.addon.setGroupedDisplay({ on: true });
  const group = run.addon.__focusNextGroup;
  const children = properties.map(property => ({ ...run.addon[property].frame }));
  for (const handler of handlers) {
    const before = { ...group.view.frame };
    drag(run, handler, -20, -10);
    closeFrame(group.view.frame, { ...before, x: before.x - 20, y: before.y - 10 });
    properties.forEach((property, index) => closeFrame(run.addon[property].frame, children[index]));
    run.addon.controllerWillLayoutSubviews(); run.advance(200);
    assert.ok(!run.addon.__focusNextDragging);
  }
  keys.forEach(key => assert.equal(defaults[prefix + key], stored[prefix + key]));
  const grouped = { ...group.view.frame };
  const restarted = runtime(defaults); restarted.addon.notebookWillOpen();
  closeFrame(restarted.addon.__focusNextGroup.view.frame, grouped);
  run.addon.setGroupedDisplay({ on: false });
  assert.equal(group.view.superview, undefined);
  properties.forEach((property, index) => {
    assert.equal(run.addon[property].superview, run.controller.view);
    closeFrame(run.addon[property].frame, independent[index]);
  });
  keys.forEach(key => assert.equal(defaults[prefix + key], stored[prefix + key]));
  run.addon.setGroupedDisplay({ on: true }); closeFrame(group.view.frame, grouped);
});

test("横竖排列分别记住位置，切换图标及重启后沿用选择", () => {
  const defaults = {};
  const run = runtime(defaults); allButtons(run); run.addon.setGroupedDisplay({ on: true });
  drag(run, "handleFocusGroupPan", -150, -80);
  const vertical = { ...run.addon.__focusNextGroup.view.frame };
  direction(run, true); drag(run, "handleFocusGroupPan", -100, -60);
  const horizontal = { ...run.addon.__focusNextGroup.view.frame };
  direction(run, false); closeFrame(run.addon.__focusNextGroup.view.frame, vertical);
  direction(run, true); closeFrame(run.addon.__focusNextGroup.view.frame, horizontal);
  const saved = JSON.parse(defaults[prefix + "group-position-horizontal"]);
  run.addon.setIconDisplay({ on: true });
  const frame = run.addon.__focusNextGroup.view.frame;
  assert.ok(Math.abs(frame.x / (1024 - frame.width) - saved.xRatio) < 0.001);
  assert.ok(Math.abs(frame.y / (768 - frame.height) - saved.yRatio) < 0.001);
  const restarted = runtime(defaults); restarted.addon.notebookWillOpen();
  assert.equal(restarted.addon.__focusNextGroup.horizontal, true);
  assert.equal(restarted.addon.__focusNextButton.title, "");
  closeFrame(restarted.addon.__focusNextGroup.view.frame, frame);
});

test("集中显示在分屏中换行或换列，切卡及窗口变化后所有按钮仍可见且不重叠", () => {
  for (const icons of [false, true]) for (const horizontal of [false, true]) {
    const run = runtime({}, 300, 200); allButtons(run);
    run.addon.setIconDisplay({ on: icons }); direction(run, horizontal); run.addon.setGroupedDisplay({ on: true });
    run.addon.focusNext();
    for (const [width, height] of [[300, 200], [250, 250], [1024, 768], [300, 200]]) {
      run.controller.view.frame = { x: 0, y: 0, width, height }; run.advance(200);
      const frame = run.addon.__focusNextGroup.view.frame;
      assert.ok(frame.x >= 0 && frame.y >= 0 && frame.x + frame.width <= width && frame.y + frame.height <= height);
      const children = properties.map(property => run.addon[property].frame);
      children.forEach((child, index) => {
        assert.ok(child.x >= 0 && child.y >= 0 && child.x + child.width <= frame.width && child.y + child.height <= frame.height);
        for (const other of children.slice(index + 1)) assert.ok(child.x + child.width <= other.x || other.x + other.width <= child.x || child.y + child.height <= other.y || other.y + other.height <= child.y);
      });
    }
  }
});

test("集中显示服从各按钮开关与总开关，关闭的按钮不留空位", () => {
  const run = runtime(); allButtons(run); run.addon.setGroupedDisplay({ on: true });
  const group = run.addon.__focusNextGroup;
  for (const [method, property] of [["setSourceEnabled", "__focusSourceButton"], ["setPreviousEnabled", "__focusPreviousButton"], ["setCollapseCommentsEnabled", "__focusCollapseCommentsButton"], ["setExpandCommentsEnabled", "__focusExpandCommentsButton"]]) {
    run.addon[method]({ on: false });
    assert.equal(run.addon[property].superview, undefined);
    assert.equal(group.entries.length, 4);
    run.addon[method]({ on: true }); assert.equal(group.entries.length, 5);
  }
  run.addon.setFocusEnabled({ on: false }); assert.equal(group.view.superview, undefined);
  run.addon.setFocusEnabled({ on: true }); assert.equal(group.view.superview, run.controller.view);
  run.addon.focusNext(); assert.equal(run.controller.notebookController.focusNote, run.nodes.a2);
  run.addon.focusPrevious(); assert.equal(run.controller.notebookController.focusNote, run.nodes.a1);
});

test("拖动期间切换集中模式或方向会完成保存，旧回调不移动新布局或误触切卡", () => {
  const run = runtime(); allButtons(run);
  let recognizer = drag(run, "handleFocusNextButtonPan", -50, -20, null);
  run.addon.setGroupedDisplay({ on: true });
  const group = run.addon.__focusNextGroup;
  const before = { ...group.view.frame };
  run.addon.handleFocusNextButtonPan(recognizer); closeFrame(group.view.frame, before);
  assert.equal(run.addon.__focusNextDragging, false);
  recognizer = drag(run, "handleFocusNextButtonPan", -30, -20, null);
  run.addon.setGroupedDisplay({ on: false });
  const independent = { ...run.addon.__focusNextButton.frame };
  run.addon.handleFocusNextButtonPan(recognizer); closeFrame(run.addon.__focusNextButton.frame, independent);
  run.addon.setGroupedDisplay({ on: true });
  drag(run, "handleFocusGroupPan", -20, -20);
  run.addon.focusNext(); assert.equal(run.controller.notebookController.focusNote, run.nodes.a1);
  run.addon.focusNext(); assert.equal(run.controller.notebookController.focusNote, run.nodes.a2);
  recognizer = drag(run, "handleFocusGroupPan", -10, -10, null);
  direction(run, true);
  const horizontal = { ...group.view.frame };
  run.addon.handleFocusGroupPan(recognizer); closeFrame(group.view.frame, horizontal);
  assert.ok(run.defaults[prefix + "group-position-vertical"]);
});

test("场景关闭或拖动取消会记住整组位置，失效的拖动回调不会继续移动", () => {
  for (const action of ["sceneWillResignActive", "notebookWillClose", "sceneDidDisconnect"]) {
    const run = runtime(); allButtons(run); run.addon.setGroupedDisplay({ on: true });
    const group = run.addon.__focusNextGroup;
    const recognizer = drag(run, "handleFocusGroupPan", -80, -40, null);
    run.addon[action]();
    const frame = { ...group.view.frame };
    run.addon.handleFocusGroupPan(recognizer); closeFrame(group.view.frame, frame);
    assert.equal(run.addon.__focusNextDragging, false);
    assert.ok(run.defaults[prefix + "group-position-vertical"]);
  }
  const run = runtime(); allButtons(run); run.addon.setGroupedDisplay({ on: true });
  drag(run, "handleFocusGroupPan", -40, -20, 4);
  assert.ok(run.defaults[prefix + "group-position-vertical"]);
  assert.equal(run.addon.__focusNextDragging, false);
});
