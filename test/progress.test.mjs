import test from "node:test";
import assert from "node:assert/strict";
import { runtime } from "./helpers/focus-runtime.mjs";

const prefix = "cn.marginnote.focus-next.";
function enable(run) { run.addon.setProgressEnabled({ on: true }); return run.addon.__focusProgressButton; }
function progressOnly(run) {
  for (const action of ["setNextEnabled", "setPreviousEnabled", "setSourceEnabled", "setAiEnabled", "setCollapseCommentsEnabled", "setExpandCommentsEnabled"]) run.addon[action]({ on: false });
  return enable(run);
}
function drag(run, dx, dy) {
  const recognizer = { state: 1, translationInView: () => ({ x: dx, y: dy }), setTranslationInView() {} };
  run.addon.handleFocusProgressPan(recognizer);
  recognizer.state = 2; run.addon.handleFocusProgressPan(recognizer);
  recognizer.state = 3; run.addon.handleFocusProgressPan(recognizer);
}

test("圆环向宿主桥接层传递 UIBezierPath，避免对 CGPath 再次调用 CGPath 导致闪退", () => {
  const run = runtime(), layers = [], rejected = [];
  const path = { CGPath: {} };
  run.context.UIBezierPath.bezierPathWithArcCenterRadiusStartAngleEndAngleClockwise = () => path;
  run.context.CAShapeLayer.layer = () => {
    let stored;
    const layer = {
      get path() { return stored; },
      set path(value) {
        if (value !== path) {
          const message = "-[__NSCFType CGPath]: unrecognized selector sent to instance";
          rejected.push(message); throw new Error(message);
        }
        stored = value;
      },
    };
    layers.push(layer); return layer;
  };
  const button = enable(run);
  assert.deepEqual(rejected, []);
  assert.equal(layers.length, 2);
  assert.equal(layers[0].path, path); assert.equal(layers[1].path, path);
  assert.equal(button.__focusNextProgressRing.strokeEnd, 0.5);
});

test("进度默认关闭，开关独立记忆；开启显示同级题号与比例，点击可查看总数", () => {
  const run = runtime();
  run.addon.notebookWillOpen();
  assert.equal(run.addon.__focusProgressButton, undefined);
  const button = enable(run);
  assert.equal(button.title, "1"); assert.equal(button.frame.width, 36); assert.equal(button.frame.height, 36);
  assert.equal(button.__focusNextProgressRing.strokeEnd, 0.5);
  const path = button.__focusNextProgressRing.path.CGPath;
  assert.equal(path.start, -Math.PI / 2); assert.equal(path.end, Math.PI * 1.5);
  assert.equal(path.clockwise, true); assert.equal(button.layer.sublayers.length, 2);
  run.addon.showProgress(); assert.match(run.messages.at(-1), /第 1\/2 张/);
  run.addon.focusToolbarClick(); run.advance(300);
  const row = run.addon.__focusNextSettings.rows.find(row => row.key === "progress");
  assert.equal(row.title.text, "做题进度"); assert.equal(row.control.on, true);
  assert.equal(run.addon.__focusNextSettings.groups[2].description.text, "已开启 5/7");
  const restarted = runtime(run.defaults); restarted.addon.notebookWillOpen();
  assert.equal(restarted.addon.__focusProgressButton.title, "1");
});

test("前后切卡立即更新题号，仍严格先切焦点再定位，不访问缩放接口", () => {
  const run = runtime(), button = enable(run);
  const start = run.calls.length;
  run.addon.focusNext();
  assert.equal(button.title, "2"); assert.equal(button.__focusNextProgressRing.strokeEnd, 1);
  assert.deepEqual(run.calls.slice(start), ["change:a2", "locate:a2"]);
  run.addon.focusPrevious();
  assert.equal(button.title, "1"); assert.equal(button.__focusNextProgressRing.strokeEnd, 0.5);
});

test("整张脑图切换时进度仍只统计当前同级，不合并后代或父层卡片", () => {
  const run = runtime(), button = enable(run);
  run.addon.setCrossLevelEnabled({ on: true });
  run.controller.notebookController.focusNote = run.nodes.a; run.advance(160);
  assert.equal(button.title, "1"); assert.equal(button.__focusNextProgressRing.strokeEnd, 0.5);
  run.addon.focusNext();
  assert.equal(run.controller.notebookController.focusNote, run.nodes.a1);
  run.addon.focusNext(); assert.equal(button.title, "2");
  run.addon.focusNext(); assert.equal(run.controller.notebookController.focusNote, run.nodes.b);
  assert.equal(button.title, "2"); assert.equal(button.__focusNextProgressRing.strokeEnd, 1);
  run.addon.focusNext(); assert.equal(button.title, "1");
  assert.equal(button.__focusNextProgressRing.strokeEnd, 1);
});

test("手动换焦点及同级增删重排均刷新，原生集合及只有一个同级也能统计", () => {
  const run = runtime(), button = enable(run);
  run.controller.notebookController.focusNote = run.nodes.a2; run.advance(160);
  assert.equal(button.title, "2");
  const extra = { noteId: "extra", parentNote: run.nodes.a };
  run.nodes.a.childNotes.push(extra); run.advance(160);
  assert.equal(button.__focusNextProgressRing.strokeEnd, 2 / 3);
  run.nodes.a.childNotes = [run.nodes.a2, run.nodes.a1, extra]; run.advance(160);
  assert.equal(button.title, "1");
  run.nodes.a.childNotes = () => ({ count: () => 1, objectAtIndex: () => run.nodes.a2 });
  run.advance(160); assert.equal(button.title, "1"); assert.equal(button.__focusNextProgressRing.strokeEnd, 1);
  run.nodes.a.childNotes = []; run.advance(160);
  assert.equal(button.title, "—"); assert.equal(button.__focusNextProgressRing.strokeEnd, 0);
});

test("只开启进度圈也能持续刷新，离开学习集后清除旧焦点并停止隐藏控件更新", () => {
  const run = runtime(), button = progressOnly(run);
  run.controller.notebookController.focusNote = run.nodes.a2; run.advance(160);
  assert.equal(button.title, "2");
  run.addon.notebookWillClose(); assert.equal(button.superview, undefined);
  run.controller.notebookController.notebookId = "new-study";
  run.controller.notebookController.focusNote = null;
  run.addon.notebookWillOpen(); assert.equal(button.title, "—");
  run.controller.notebookController.focusNote = run.nodes.b1; run.advance(160);
  assert.equal(button.title, "1"); assert.equal(button.__focusNextProgressRing.strokeEnd, 1);
  run.addon.setProgressEnabled({ on: false });
  assert.equal(button.superview, undefined);
  run.controller.notebookController.focusNote = run.nodes.a2; run.advance(300);
  assert.equal(button.title, "1");
});

test("集中横竖布局中进度始终在首位并保持圆形，文字图标切换不覆盖题号", () => {
  for (const icons of [false, true]) for (const horizontal of [false, true]) {
    const run = runtime(), button = enable(run);
    run.addon.setIconDisplay({ on: icons });
    run.addon.setGroupDirection({ selectedSegmentIndex: horizontal ? 1 : 0 });
    run.addon.setGroupedDisplay({ on: true });
    const group = run.addon.__focusNextGroup;
    assert.equal(group.entries[0].button, button);
    assert.equal(button.title, "1"); assert.equal(button.frame.width, 36); assert.equal(button.frame.height, 36);
    const next = group.entries[1].button;
    if (horizontal) assert.ok(button.frame.x + button.frame.width <= next.frame.x);
    else assert.ok(button.frame.y + button.frame.height <= next.frame.y);
    const before = { ...group.view.frame }; drag(run, -100, -30);
    assert.equal(group.view.frame.x, before.x - 100); assert.equal(group.view.frame.y, before.y - 30);
  }
});

test("独立进度圈可拖动记忆；开关和总开关保留位置，分屏后仍在视区内", () => {
  const run = runtime(), button = enable(run);
  drag(run, -130, -90);
  const moved = { ...button.frame };
  assert.ok(run.defaults[prefix + "progress-button-position"]);
  run.addon.setFocusEnabled({ on: false }); assert.equal(button.superview, undefined);
  run.addon.setFocusEnabled({ on: true });
  assert.deepEqual({ ...button.frame }, moved);
  const restarted = runtime(run.defaults); restarted.addon.notebookWillOpen();
  assert.deepEqual({ ...restarted.addon.__focusProgressButton.frame }, moved);
  run.controller.view.frame = { x: 0, y: 0, width: 300, height: 320 }; run.advance(300);
  assert.ok(button.frame.x >= 0 && button.frame.x + 36 <= 300);
  assert.ok(button.frame.y >= 0 && button.frame.y + 36 <= 320);
  run.addon.sceneDidDisconnect(); assert.equal(run.addon.__focusProgressButton, null);
});

test("没有焦点时显示横线，根卡显示1，圆环能力缺失时仍可显示题号", () => {
  for (const missing of ["CAShapeLayer", "UIBezierPath", "path"]) {
    const run = runtime(); run.controller.notebookController.focusNote = null;
    if (missing === "path") run.context.UIBezierPath.bezierPathWithArcCenterRadiusStartAngleEndAngleClockwise = () => null;
    else run.context[missing] = undefined;
    const button = enable(run); assert.equal(button.title, "—");
    run.addon.showProgress(); assert.match(run.messages.at(-1), /先进入/);
    run.controller.notebookController.focusNote = run.nodes.root; run.advance(160);
    assert.equal(button.title, "1"); assert.equal(button.__focusNextProgressRing, undefined);
  }
});

test("大题号缩小字体，进度仅写入显示偏好而不记录作答状态", () => {
  const run = runtime();
  const children = Array.from({ length: 1001 }, (_, index) => ({ noteId: "sibling-" + index, parentNote: run.nodes.a }));
  run.nodes.a.childNotes = children;
  run.controller.notebookController.focusNote = children[1000];
  const button = enable(run);
  assert.equal(button.title, "1001"); assert.equal(button.titleLabel.font, 8);
  assert.equal(button.__focusNextProgressRing.strokeEnd, 1);
  assert.deepEqual(Object.keys(run.defaults), [prefix + "progress-enabled"]);
});
