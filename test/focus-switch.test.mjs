import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runtime } from "./helpers/focus-runtime.mjs";

test("更名保留插件身份、版本和旧设置，生成新的固定测试包名", () => {
  const manifest = JSON.parse(readFileSync(new URL("../src/mnaddon.json", import.meta.url)));
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
  assert.equal(manifest.title, "Focus Switch");
  assert.equal(manifest.addonid, "cn.marginnote.focus-next");
  assert.equal(manifest.version, pkg.version);
  assert.equal(pkg.mnaddonFileName, "Focus Switch Test");
  const run = runtime({ "cn.marginnote.focus-next.enabled": false });
  run.addon.notebookWillOpen();
  assert.equal(run.addon.focusNextEnabled, false);
  assert.equal(run.addon.__focusNextButton, undefined);
  assert.equal(run.addon.queryAddonCommandStatus().selector, "focusToolbarClick:");
});

test("单击只弹出窄面板，显示相关设置上移，默认值与说明准确", () => {
  const run = runtime();
  run.addon.focusToolbarClick(); run.advance(299);
  assert.equal(run.addon.__focusNextSettings, undefined);
  run.advance(1);
  const menu = run.addon.__focusNextSettings;
  assert.equal(menu.panel.frame.width, 340);
  assert.ok(menu.panel.frame.height <= 496);
  assert.ok(menu.scroll.contentSize.height >= menu.scroll.frame.height);
  assert.equal(menu.panel.superview, run.controller.view);
  assert.equal(run.addon.focusNextEnabled, true);
  assert.deepEqual(Array.from(menu.rows, row => row.title.text), ["启用焦点切换", "按钮样式", "按钮布局", "排列方向", "切换范围", "下一张", "上一张", "查看原题", "问 AI", "折叠评论", "展开评论"]);
  assert.deepEqual(Array.from(menu.rows, row => row.segmented ? row.control.selectedSegmentIndex : row.control.on), [true, 0, 0, 0, 0, true, true, false, false, true, true]);
  assert.deepEqual(menu.rows[3].control.segments, ["竖向", "横向"]);
  run.addon.closeFocusSettings();
  assert.equal(menu.panel.superview, undefined);
});

test("小窗口菜单收窄且可滚动，文字与开关不重叠", () => {
  const run = runtime({}, 300, 320);
  run.addon.focusToolbarClick(); run.advance(300);
  const menu = run.addon.__focusNextSettings;
  assert.equal(menu.panel.frame.width, 276);
  assert.ok(menu.panel.frame.y + menu.panel.frame.height <= 320);
  assert.ok(menu.scroll.contentSize.height > menu.scroll.frame.height);
  for (const row of menu.rows) {
    assert.ok(row.title.frame.x + row.title.frame.width < row.control.frame.x);
    if (!row.description.hidden) assert.ok(row.description.frame.y >= row.control.frame.y + row.control.frame.height);
    assert.ok(row.control.frame.x + row.control.frame.width <= menu.panel.frame.width);
    assert.equal(row.description.numberOfLines, 2);
  }
  run.controller.view.frame = { x: 0, y: 0, width: 1024, height: 768 };
  run.advance(200);
  assert.equal(menu.panel.frame.width, 340);
});

test("双击切换开启和关闭一次，不弹菜单，取消后的旧回调无效", () => {
  const run = runtime();
  run.addon.notebookWillOpen(); run.addon.focusToolbarClick();
  const stale = run.addon.__focusNextClickTimer;
  run.advance(100); run.addon.focusToolbarClick();
  assert.equal(run.addon.focusNextEnabled, false);
  assert.equal(run.defaults["cn.marginnote.focus-next.enabled"], false);
  assert.equal(run.addon.__focusNextButton.superview, undefined);
  assert.equal(run.addon.__focusPreviousButton.superview, undefined);
  stale.callback(); run.advance(500);
  assert.equal(run.addon.__focusNextSettings, undefined);
  run.addon.focusToolbarClick(); run.advance(100); run.addon.focusToolbarClick();
  assert.equal(run.addon.focusNextEnabled, true);
  assert.equal(run.addon.__focusNextButton.superview, run.controller.view);
  assert.equal(run.addon.queryAddonCommandStatus().checked, true);
  assert.equal(run.calls.filter(call => call === "refresh-toolbar").length, 2);
});

test("设置上一张立即生效并持久化，关闭总开关移除全部导航", () => {
  const defaults = { "cn.marginnote.focus-next.previous-button-position": JSON.stringify({ xRatio: 0.2, yRatio: 0.3 }) };
  const run = runtime(defaults);
  run.addon.notebookWillOpen();
  assert.equal(run.addon.__focusNextButton.title, "下一张");
  assert.equal(run.addon.__focusNextButton.frame.width, 76);
  const previousPosition = defaults["cn.marginnote.focus-next.previous-button-position"];
  run.addon.setPreviousEnabled({ on: false });
  assert.equal(run.addon.__focusPreviousButton.superview, undefined);
  assert.equal(run.addon.__focusNextButton.superview, run.controller.view);
  run.addon.focusNext();
  assert.equal(run.addon.__focusNextButton.title, "下一张");
  run.addon.setPreviousEnabled({ on: true });
  assert.equal(defaults["cn.marginnote.focus-next.previous-button-position"], previousPosition);
  assert.equal(run.addon.__focusPreviousButton.title, "上一张");
  run.addon.setFocusEnabled({ on: false });
  const callsBefore = run.calls.length;
  run.addon.focusNext();
  assert.equal(run.calls.length, callsBefore);
  assert.equal(run.addon.__focusNextButton.superview, undefined);
  const restarted = runtime(defaults);
  assert.equal(restarted.addon.focusNextEnabled, false);
  restarted.addon.setFocusEnabled({ on: true });
  assert.equal(restarted.addon.__focusNextButton.title, "下一张");
  assert.equal(restarted.addon.__focusNextButton.frame.width, 76);
});

test("跨层级遍历前序所有节点并严格逆序返回，树首尾停止", () => {
  const run = runtime();
  const core = run.context.__FOCUS_NEXT_CORE_GLOBAL__;
  run.addon.setCrossLevelEnabled({ on: true });
  run.controller.notebookController.focusNote = run.nodes.root;
  run.addon.__focusNextLastFocus = run.nodes.root;
  for (const target of run.nodes.notes.slice(1)) assert.equal(core.focusNext(run.addon).next, target);
  const callsBefore = run.calls.length;
  assert.throws(() => core.focusNext(run.addon), /整棵脑图的最后一张/);
  assert.equal(run.calls.length, callsBefore);
  for (const target of run.nodes.notes.slice(0, -1).reverse()) assert.equal(core.focusPrevious(run.addon).next, target);
  assert.throws(() => core.focusPrevious(run.addon), /整棵脑图的第一张/);
  const changes = run.calls.filter(call => /^(change|locate):/.test(call));
  for (let index = 0; index < changes.length; index += 2) assert.equal(changes[index].slice(7), changes[index + 1].slice(7));
  run.addon.setCrossLevelEnabled({ on: false });
  run.controller.notebookController.focusNote = run.nodes.a2;
  run.addon.__focusNextLastFocus = run.nodes.a2;
  assert.throws(() => core.focusNext(run.addon), /最后一张同级卡片/);
});

for (const method of ["sceneWillResignActive", "notebookWillOpen", "notebookWillClose", "sceneDidDisconnect"]) {
  test(`${method}取消未执行的单击，旧回调不会重新打开菜单`, () => {
    const run = runtime();
    run.addon.focusToolbarClick();
    const stale = run.addon.__focusNextClickTimer;
    run.addon[method](); stale.callback(); run.advance(400);
    assert.ok(!run.addon.__focusNextSettings || !run.addon.__focusNextSettings.panel.superview);
  });
}

function openMenu(run) { run.addon.focusToolbarClick(); run.advance(300); return run.addon.__focusNextSettings; }

test("缩小后的开关保留整行点击，折叠及关闭后不响应，原生事件仍独立生效", () => {
  const run = runtime();
  run.addon.notebookWillOpen();
  const menu = openMenu(run);
  run.addon.toggleButtonsSection();
  const row = menu.rows.find(row => row.key === "next");
  const initial = { ...row.control.frame };
  assert.ok(Math.abs(initial.width - 43.35) < 0.001);
  assert.ok(Math.abs(initial.height - 26.35) < 0.001);
  assert.ok(row.hitButton.frame.height >= 44);
  assert.equal(row.hitButton.selector, "toggleSettingsSwitchRow:");
  run.addon.toggleSettingsSwitchRow(row.hitButton);
  assert.equal(row.control.on, false);
  assert.equal(run.addon.__focusNextButton.hidden, true);
  run.addon.toggleSettingsSwitchRow(row.hitButton);
  assert.equal(row.control.on, true);
  run.addon.setNextEnabled({ on: false });
  assert.equal(row.control.on, false);
  assert.deepEqual({ ...row.control.frame }, initial);
  for (let index = 0; index < 5; index++) run.addon.controllerWillLayoutSubviews();
  assert.deepEqual({ ...row.control.frame }, initial);
  run.addon.toggleButtonsSection();
  assert.equal(row.hitButton.hidden, true);
  run.addon.toggleSettingsSwitchRow(row.hitButton);
  assert.equal(row.control.on, false);
  run.addon.closeFocusSettings();
  run.addon.toggleSettingsSwitchRow(menu.rows[0].hitButton);
  assert.equal(run.addon.focusNextEnabled, true);
});

test("关闭使用16点本地图标和44点点击区域，页脚上下留白各8点", () => {
  const run = runtime();
  run.addon.setSourceEnabled({ on: true });
  const menu = openMenu(run);
  assert.equal(menu.close.title, "");
  assert.equal(menu.close.image.resourcePath, "button-icons/panel-close.png");
  assert.deepEqual(menu.close.image.size, { width: 16, height: 16 });
  assert.equal(menu.close.frame.width, 44);
  assert.equal(menu.close.frame.height, 44);
  assert.equal(menu.close.selector, "closeFocusSettings:");
  const last = menu.groups[2].button.frame;
  assert.equal(menu.footer.frame.y - last.y - last.height, 8);
  assert.equal(menu.scroll.contentSize.height - menu.footer.frame.y - menu.footer.frame.height, 8);
  run.addon.closeFocusSettings();
  assert.equal(menu.panel.superview, undefined);
  assert.equal(run.addon.focusNextEnabled, true);
  assert.equal(run.addon.__focusNextButton.hidden, false);
});

test("卡片切换范围沿用旧偏好，选择后同步摘要、说明及实际切换行为", () => {
  for (const crossLevel of [false, true]) {
    const defaults = { "cn.marginnote.focus-next.cross-level-enabled": crossLevel };
    const run = runtime(defaults, 300, 500);
    const menu = openMenu(run);
    run.addon.toggleNavigationSection();
    const row = menu.rows.find(row => row.key === "crossLevel");
    assert.equal(menu.groups[1].title.text, "卡片切换");
    assert.equal(row.title.text, "切换范围");
    assert.equal(row.control.selector, "setNavigationScope:");
    assert.deepEqual(row.control.segments, ["同级", "整张脑图"]);
    assert.equal(row.control.selectedSegmentIndex, crossLevel ? 1 : 0);
    assert.equal(row.control.frame.width, 140);
    for (const index of [0, 1]) {
      run.addon.setNavigationScope({ selectedSegmentIndex: index });
      assert.equal(row.control.selectedSegmentIndex, index);
      assert.equal(defaults["cn.marginnote.focus-next.cross-level-enabled"], index === 1);
      assert.equal(menu.groups[1].description.text, index ? "整张脑图" : "同级卡片");
      assert.match(row.description.text, index ? /先父卡片、再子卡片/ : /同级兄弟卡片/);
      run.controller.notebookController.focusNote = run.nodes.a;
      run.addon.__focusNextLastFocus = run.nodes.a;
      run.addon.focusNext();
      assert.equal(run.controller.notebookController.focusNote, index ? run.nodes.a1 : run.nodes.b);
    }
    for (const index of [-1, 2, NaN]) run.addon.setNavigationScope({ selectedSegmentIndex: index });
    assert.equal(row.control.selectedSegmentIndex, 1);
    const restarted = runtime(defaults);
    const restored = openMenu(restarted);
    assert.equal(restored.groups[1].description.text, "整张脑图");
    assert.equal(restored.rows.find(row => row.key === "crossLevel").control.selectedSegmentIndex, 1);
  }
});

test("各组箭头共用相同几何图形的两个方向，反复展开不改变尺寸或中心", () => {
  const run = runtime();
  const menu = openMenu(run);
  for (const [index, method] of ["toggleAppearanceSection", "toggleNavigationSection", "toggleButtonsSection"].entries()) {
    const group = menu.groups[index];
    const frame = { ...group.arrow.frame };
    for (let click = 0; click < 4; click++) {
      run.addon[method]();
      assert.equal(group.arrow.image.resourcePath, group.expanded ? "button-icons/section-chevron-down.png" : "button-icons/section-chevron-right.png");
      assert.deepEqual(group.arrow.image.size, { width: 14, height: 14 });
      assert.deepEqual({ ...group.arrow.frame }, frame);
      assert.equal(group.arrow.superview, group.button);
    }
  }
});

test("默认展开外观，折叠其他两组，查看原题关闭且其余四个按钮开启", () => {
  const run = runtime();
  run.addon.notebookWillOpen();
  const menu = openMenu(run);
  assert.deepEqual(Array.from(menu.groups, group => group.expanded), [true, false, false]);
  assert.equal(menu.groups[0].description.text, "文字 · 分散 · 竖向");
  assert.equal(menu.groups[1].description.text, "同级卡片");
  assert.equal(menu.groups[2].description.text, "已开启 4/6");
  for (const property of ["__focusNextButton", "__focusPreviousButton", "__focusCollapseCommentsButton", "__focusExpandCommentsButton"]) assert.equal(run.addon[property].hidden, false);
  assert.equal(run.addon.__focusSourceButton, undefined);
  const selectors = ["toggleAppearanceSection:", "toggleNavigationSection:", "toggleButtonsSection:"];
  menu.groups.forEach((group, index) => {
    assert.equal(group.button.selector, selectors[index]);
    assert.equal(group.button.target, run.addon);
    assert.equal(group.arrow.image.resourcePath, group.expanded ? "button-icons/section-chevron-down.png" : "button-icons/section-chevron-right.png");
    assert.deepEqual(group.arrow.image.size, { width: 14, height: 14 });
    for (const key of group.keys) {
      const row = menu.rows.find(row => row.key === key);
      assert.equal(row.title.hidden, !group.expanded);
      assert.equal(row.control.hidden, !group.expanded);
    }
  });
});

test("分组可同时展开，独立记忆，收起不改按钮设置且修正滚动位置", () => {
  const defaults = { "cn.marginnote.focus-next.source-enabled": true, "cn.marginnote.focus-next.previous-enabled": false };
  const run = runtime(defaults);
  const menu = openMenu(run);
  run.addon.toggleNavigationSection(); run.addon.toggleButtonsSection();
  assert.deepEqual(Array.from(menu.groups, group => group.expanded), [true, true, true]);
  run.addon.setButtonStyle({ selectedSegmentIndex: 1 });
  run.addon.setButtonLayout({ selectedSegmentIndex: 1 });
  run.addon.setGroupDirection({ selectedSegmentIndex: 1 });
  run.addon.setCrossLevelEnabled({ on: true });
  assert.equal(menu.groups[0].description.text, "图标 · 集中 · 横向");
  assert.equal(menu.groups[1].description.text, "整张脑图");
  assert.equal(menu.groups[2].description.text, "已开启 4/6");
  run.addon.setNextEnabled({ on: false });
  assert.equal(menu.groups[2].description.text, "已开启 3/6");
  const settingsBefore = { ...defaults };
  const origin = { x: menu.panel.frame.x, y: menu.panel.frame.y };
  menu.scroll.contentOffset = { x: 0, y: 100000 };
  run.addon.toggleAppearanceSection(); run.addon.toggleNavigationSection(); run.addon.toggleButtonsSection();
  assert.deepEqual(Array.from(menu.groups, group => group.expanded), [false, false, false]);
  assert.ok(menu.panel.frame.height < 496);
  assert.equal(menu.panel.frame.x, origin.x);
  assert.equal(menu.panel.frame.y, origin.y);
  run.addon.controllerWillLayoutSubviews(); run.advance(200);
  assert.equal(menu.panel.frame.y, origin.y);
  assert.equal(menu.scroll.contentOffset.y, 0);
  assert.equal(menu.commentsHint.hidden, true);
  assert.equal(menu.directionHint.hidden, true);
  for (const key of Object.keys(settingsBefore).filter(key => !key.endsWith('settings-sections') && !key.endsWith('settings-panel-position'))) assert.equal(defaults[key], settingsBefore[key]);
  const restarted = runtime(defaults);
  const restored = openMenu(restarted);
  assert.deepEqual(Array.from(restored.groups, group => group.expanded), [false, false, false]);
  assert.ok(Math.abs(restored.panel.frame.y - origin.y) < 0.001);
  assert.equal(restored.groups[2].description.text, "已开启 3/6");
  assert.equal(restored.rows.find(row => row.key === "source").control.on, true);
  run.addon.closeFocusSettings();
  const stored = defaults["cn.marginnote.focus-next.settings-sections"];
  run.addon.toggleAppearanceSection();
  assert.equal(defaults["cn.marginnote.focus-next.settings-sections"], stored);
});

test("损坏或部分分组配置采用各组默认值，不覆盖已有按钮偏好", () => {
  for (const value of ['bad-json', 'null', '{"appearance":"false","navigation":true,"buttons":false}']) {
    const run = runtime({ "cn.marginnote.focus-next.settings-sections": value, "cn.marginnote.focus-next.source-enabled": false });
    const menu = openMenu(run);
    assert.deepEqual(Array.from(menu.groups, group => group.expanded), [true, value.includes('"navigation":true'), false]);
    assert.equal(menu.rows.find(row => row.key === "source").control.on, false);
  }
});

test("下一张开关位于上一张上方，独立记忆并在重启和总开关切换后保留", () => {
  for (const icons of [false, true]) for (const grouped of [false, true]) for (const horizontal of [false, true]) {
    const defaults = {};
    const run = runtime(defaults);
    run.addon.setIconDisplay({ on: icons });
    run.addon.setGroupDirection({ selectedSegmentIndex: horizontal ? 1 : 0 });
    run.addon.setGroupedDisplay({ on: grouped });
    const menu = openMenu(run);
    run.addon.toggleButtonsSection();
    const index = menu.rows.findIndex(row => row.key === "next");
    const control = menu.rows[index].control;
    assert.equal(menu.rows[index + 1].key, "previous");
    assert.equal(control.on, true);
    assert.equal(control.selector, "setNextEnabled:");
    assert.ok(menu.rows[index].control.frame.y < menu.rows[index + 1].control.frame.y);
    const next = run.addon.__focusNextButton;
    const positionKey = "cn.marginnote.focus-next.next-button-position";
    defaults[positionKey] = JSON.stringify({ xRatio: 0.4, yRatio: 0.3 });
    const saved = defaults[positionKey];
    run.addon.setNextEnabled({ on: false });
    assert.equal(control.on, false);
    assert.equal(defaults["cn.marginnote.focus-next.next-enabled"], false);
    assert.equal(next.hidden, true);
    assert.equal(next.superview, undefined);
    assert.equal(run.addon.__focusPreviousButton.hidden, false);
    const before = run.calls.length;
    run.addon.focusNext();
    assert.equal(run.calls.length, before);
    run.addon.setFocusEnabled({ on: false });
    run.addon.setFocusEnabled({ on: true });
    assert.equal(next.hidden, true);
    const restarted = runtime(defaults);
    restarted.addon.notebookWillOpen();
    assert.equal(restarted.addon.__focusNextButton, undefined);
    assert.equal(openMenu(restarted).rows.find(row => row.key === "next").control.on, false);
    run.addon.setNextEnabled({ on: true });
    assert.equal(next.hidden, false);
    assert.equal(next.superview, grouped ? run.addon.__focusNextGroup.view : run.controller.view);
    assert.equal(defaults[positionKey], saved);
    run.addon.focusNext();
    assert.equal(run.controller.notebookController.focusNote, run.nodes.a2);
  }
});

test("所有显示开关关闭时移除集中工具条，重新开启下一张后正常恢复", () => {
  for (const initiallyDisabled of [false, true]) {
    const defaults = initiallyDisabled ? {
      "cn.marginnote.focus-next.next-enabled": false,
      "cn.marginnote.focus-next.previous-enabled": false,
      "cn.marginnote.focus-next.collapse-comments-enabled": false,
      "cn.marginnote.focus-next.expand-comments-enabled": false,
    } : {};
    const run = runtime(defaults);
    run.addon.setGroupedDisplay({ on: true });
    for (const setter of ["setPreviousEnabled", "setCollapseCommentsEnabled", "setExpandCommentsEnabled", "setNextEnabled"]) run.addon[setter]({ on: false });
    run.advance(200);
    assert.ok(!run.addon.__focusNextGroup || !run.addon.__focusNextGroup.view.superview);
    assert.ok(!run.controller.view.subviews.some(view => view.selector === "focusNext:"));
    run.addon.setNextEnabled({ on: true });
    const group = run.addon.__focusNextGroup;
    assert.equal(group.view.superview, run.controller.view);
    assert.equal(group.entries.length, 1);
    assert.equal(group.entries[0].button, run.addon.__focusNextButton);
    run.addon.focusNext();
    assert.equal(run.controller.notebookController.focusNote, run.nodes.a2);
  }
});

test("折叠分组在分屏及横竖屏下保持层级、开关和页脚间距", () => {
  for (const [width, height] of [[300, 320], [375, 667], [768, 1024], [1024, 768]]) {
    const run = runtime({}, width, height);
    const menu = openMenu(run);
    run.addon.toggleNavigationSection(); run.addon.toggleButtonsSection();
    assert.deepEqual(Array.from(menu.groups, group => group.title.text), ["外观与排列", "卡片切换", "显示按钮"]);
    assert.equal(menu.groups[2].description.text, "已开启 4/6");
    assert.equal(menu.rows[0].control.superview, menu.panel);
    assert.ok(menu.scroll.frame.y >= menu.rows[0].control.frame.y + 31);
    let bottom = 0;
    for (const group of menu.groups) {
      assert.ok(group.button.frame.y >= bottom);
      assert.equal(group.title.frame.x, 16);
      assert.ok(group.arrow.frame.x > group.title.frame.x + group.title.frame.width);
      bottom = group.button.frame.y + group.button.frame.height;
      for (const key of group.keys) {
        const row = menu.rows.find(row => row.key === key);
        assert.equal(row.control.hidden, false);
        assert.ok(row.title.frame.x > group.title.frame.x);
        assert.ok(row.divider.frame.y >= bottom);
        assert.ok(row.title.frame.x + row.title.frame.width < row.control.frame.x);
        assert.equal(row.control.frame.x + row.control.frame.width, menu.panel.frame.width - 16);
        assert.ok(Math.abs(row.control.frame.height - (row.segmented ? 31 : 26.35)) < 0.001);
        bottom = row.divider.frame.y + (row.description.text ? 76 : 54);
        if (!row.description.hidden) assert.ok(row.description.frame.y >= row.control.frame.y + 31);
      }
      const hint = group.key === "appearance" ? menu.directionHint : group.key === "buttons" ? menu.commentsHint : null;
      if (hint) { assert.ok(hint.frame.y >= bottom); bottom = hint.frame.y + hint.frame.height; }
    }
    assert.ok(menu.footer.frame.y >= bottom + 8);
    assert.equal(menu.scroll.contentSize.height - menu.footer.frame.y - menu.footer.frame.height, 8);
    assert.equal(menu.footer.superview, menu.scroll);
    assert.match(menu.footer.text, /Focus Switch · 乔木Joe · /);
    assert.ok(menu.panel.frame.y + menu.panel.frame.height <= height - 12);
  }
});

test("按钮样式选择沿用旧偏好，切换及重启保留设置且不执行评论操作", () => {
  const defaults = { "cn.marginnote.focus-next.icon-display": true };
  const run = runtime(defaults);
  const menu = openMenu(run);
  const style = menu.rows.find(row => row.key === "iconDisplay").control;
  assert.deepEqual(style.segments, ["文字", "图标"]);
  assert.equal(style.selectedSegmentIndex, 1);
  const comments = JSON.stringify(run.nodes.notes.map(note => note.comments));
  run.addon.setButtonStyle({ selectedSegmentIndex: 0 });
  assert.equal(style.selectedSegmentIndex, 0);
  assert.equal(defaults["cn.marginnote.focus-next.icon-display"], false);
  for (const index of [-1, 2, NaN]) run.addon.setButtonStyle({ selectedSegmentIndex: index });
  assert.equal(defaults["cn.marginnote.focus-next.icon-display"], false);
  run.addon.setButtonStyle({ selectedSegmentIndex: 1 });
  const restarted = runtime(defaults);
  assert.equal(openMenu(restarted).rows.find(row => row.key === "iconDisplay").control.selectedSegmentIndex, 1);
  assert.equal(JSON.stringify(run.nodes.notes.map(note => note.comments)), comments);
  assert.deepEqual(run.messages, []);
});

function drag(run, moves, terminal = 3) {
  const resets = [];
  const recognizer = {
    state: 1, translation: { x: 0, y: 0 },
    translationInView(view) { assert.equal(view, run.controller.view); return this.translation; },
    setTranslationInView(value, view) { assert.equal(view, run.controller.view); resets.push({ x: value.x, y: value.y }); this.translation = value; },
  };
  run.addon.handleFocusSettingsPan(recognizer);
  for (const [x, y] of moves) {
    recognizer.state = 2; recognizer.translation = { x, y };
    run.addon.handleFocusSettingsPan(recognizer);
  }
  if (terminal !== null) { recognizer.state = terminal; run.addon.handleFocusSettingsPan(recognizer); }
  return { recognizer, resets };
}

test("菜单只有标题栏可拖动，关闭按钮、开关和滚动区保持独立", () => {
  const run = runtime();
  const menu = openMenu(run);
  assert.equal(menu.header.gestures.length, 1);
  assert.equal(menu.header.gestures[0].selector, "handleFocusSettingsPan:");
  assert.equal(menu.header.gestures[0].target, run.addon);
  assert.equal(menu.header.frame.height, 44);
  assert.equal(menu.close.frame.y, 0);
  assert.equal(menu.close.frame.height, 44);
  assert.ok(menu.title.frame.y + menu.title.frame.height <= menu.header.frame.height);
  const master = menu.rows[0];
  assert.equal(menu.scroll.frame.y, 88);
  assert.ok(Math.abs(master.control.frame.height - 26.35) < 0.001);
  assert.equal(master.control.frame.y + master.control.frame.height / 2, 66);
  assert.equal(master.title.frame.y + master.title.frame.height / 2, 66);
  assert.ok(menu.header.frame.x + menu.header.frame.width < menu.close.frame.x);
  for (const view of [menu.panel, menu.close, menu.scroll, ...menu.rows.map(row => row.control)]) assert.equal(view.gestures, undefined);
  assert.equal(menu.close.selector, "closeFocusSettings:");
});

test("拖动按增量移动，布局不会拉回原位，松手后恢复与重启均沿用位置", () => {
  const defaults = {};
  const run = runtime(defaults);
  const menu = openMenu(run);
  const origin = { ...menu.panel.frame };
  const { recognizer, resets } = drag(run, [[-150, 100], [-50, 50]], null);
  assert.equal(menu.panel.frame.x, origin.x - 200);
  assert.equal(menu.panel.frame.y, origin.y + 150);
  const moved = { ...menu.panel.frame };
  run.addon.controllerWillLayoutSubviews(); run.advance(200);
  assert.deepEqual({ ...menu.panel.frame }, moved);
  assert.equal(defaults["cn.marginnote.focus-next.settings-panel-position"], undefined);
  recognizer.state = 3; run.addon.handleFocusSettingsPan(recognizer);
  const saved = JSON.parse(defaults["cn.marginnote.focus-next.settings-panel-position"]);
  assert.ok(saved.xRatio > 0 && saved.xRatio < 1);
  assert.ok(saved.yRatio > 0 && saved.yRatio < 1);
  assert.deepEqual(resets, [{ x: 0, y: 0 }, { x: 0, y: 0 }]);
  run.addon.closeFocusSettings(); openMenu(run);
  assert.ok(Math.abs(menu.panel.frame.x - moved.x) < 0.001);
  assert.ok(Math.abs(menu.panel.frame.y - moved.y) < 0.001);
  const restarted = runtime(defaults);
  const restored = openMenu(restarted);
  assert.ok(Math.abs(restored.panel.frame.x - moved.x) < 0.001);
  assert.ok(Math.abs(restored.panel.frame.y - moved.y) < 0.001);
});

test("拖动限制在边界，窗口缩小后保持面板可见且恢复原有比例", () => {
  const defaults = {};
  const run = runtime(defaults);
  const menu = openMenu(run);
  drag(run, [[-10000, -10000]]);
  assert.equal(menu.panel.frame.x, 12); assert.equal(menu.panel.frame.y, 12);
  drag(run, [[10000, 10000]]);
  assert.equal(menu.panel.frame.x + menu.panel.frame.width, 1012);
  assert.equal(menu.panel.frame.y + menu.panel.frame.height, 756);
  const saved = defaults["cn.marginnote.focus-next.settings-panel-position"];
  run.controller.view.frame = { x: 0, y: 0, width: 300, height: 320 };
  run.advance(200);
  assert.equal(menu.panel.frame.width, 276);
  assert.equal(menu.panel.frame.x, 12);
  assert.ok(menu.panel.frame.y >= 12);
  assert.ok(menu.panel.frame.y + menu.panel.frame.height <= 308);
  assert.equal(defaults["cn.marginnote.focus-next.settings-panel-position"], saved);
  run.controller.view.frame = { x: 0, y: 0, width: 1024, height: 768 };
  run.advance(200);
  assert.equal(menu.panel.frame.x + menu.panel.frame.width, 1012);
  assert.equal(menu.panel.frame.y + menu.panel.frame.height, 756);
});

test("取消拖动与中途关菜单保存当前位置，隐藏后的手势不移动或写入", () => {
  const defaults = {};
  const run = runtime(defaults);
  const menu = openMenu(run);
  drag(run, [[-100, 20]], 4);
  assert.equal(menu.dragging, false);
  assert.ok(defaults["cn.marginnote.focus-next.settings-panel-position"]);
  const { recognizer } = drag(run, [[-50, 30]], null);
  const moved = { ...menu.panel.frame };
  run.addon.closeFocusSettings();
  assert.equal(menu.dragging, false);
  const saved = defaults["cn.marginnote.focus-next.settings-panel-position"];
  recognizer.translation = { x: 500, y: 500 }; recognizer.state = 2;
  run.addon.handleFocusSettingsPan(recognizer);
  assert.equal(defaults["cn.marginnote.focus-next.settings-panel-position"], saved);
  assert.deepEqual({ ...menu.panel.frame }, moved);
  openMenu(run);
  assert.ok(Math.abs(menu.panel.frame.x - moved.x) < 0.001);
  assert.ok(Math.abs(menu.panel.frame.y - moved.y) < 0.001);
});

for (const stored of ["broken-json", "null", '{"xRatio":null,"yRatio":0.5}', '{"xRatio":"NaN","yRatio":0.5}']) {
  test(`无效菜单位置使用默认位置：${stored}`, () => {
    const run = runtime({ "cn.marginnote.focus-next.settings-panel-position": stored });
    const menu = openMenu(run);
    assert.equal(menu.panel.frame.x, 672); assert.equal(menu.panel.frame.y, 100);
  });
}

const sourceCases = [
  ["大观园数学", "daguanyuan-bridge?action=open&provider=math&question=42&year=0&url=" + encodeURIComponent("https://cxyonly.fans/math/practice/categories/8?questionId=42"), "DAGUANYUAN_QUESTION_ID:42"],
  ["大观园408", "daguanyuan-bridge?action=open&provider=408&question=42&year=2023&url=" + encodeURIComponent("https://www.408os.cn/exercise?year=2023&questionId=42"), "DAGUANYUAN_408_QUESTION_ID:42"],
  ["研客岸数学", "yankean-bridge?action=open&source=math&question=42", "YANKEAN_PAPER_QUESTION:MATH:42"],
  ["研客岸408", "yankean-bridge?action=open&source=cse408&question=42&point=8&year=2023&number=6", "YANKEAN_PAPER_QUESTION:CSE408:42"],
  ["研客岸耐刷王", "yankean-bridge?action=open&source=naishua&question=42", "YANKEAN_QUESTION:NAISHUA:42"],
  ["研客岸模拟卷", "yankean-bridge?action=open&source=mock&question=42", "YANKEAN_QUESTION:MOCK:42"],
  ["疾风劲草试卷", "jifengjincao-bridge?action=open&paper=8&question=42", "JFJC_QUESTION:8:42"],
  ["疾风劲草单题", "jifengjincao-bridge?action=open&paper=0&question=42", "JFJC_QUESTION:0:42"],
];

function setSource(note, message = sourceCases[2][1], marker = sourceCases[2][2]) {
  const url = "marginnote4app://addon/" + message;
  note.comments = [{ text: "题干" }, { text: `[查看原题](${url})\n\n<!-- ${marker} -->` }];
  return url;
}

for (const [name, message, marker] of sourceCases) {
  test(`${name}选中题卡和进入焦点均打开对应插件原题链接，选中优先`, () => {
    const run = runtime();
    const expected = setSource(run.nodes.a2, message, marker);
    run.addon.setSourceEnabled({ on: true });
    run.controller.notebookController.mindmapView.selViewLst = [{ note: { note: run.nodes.a2 } }];
    run.addon.pressOriginal(); run.addon.openOriginal();
    assert.equal(run.urls[0], expected);
    run.controller.notebookController.mindmapView.selViewLst = [];
    run.controller.notebookController.visibleFocusNote = run.nodes.a2;
    run.addon.pressOriginal(); run.addon.openOriginal();
    assert.deepEqual(run.urls, [expected, expected]);
    assert.equal(run.messages.length, 0);
    assert.equal(run.calls.filter(call => /^(change|locate):/.test(call)).length, 0);
  });
}

test("焦点读取短暂清空时，查看原题沿用当前学习集刚刚记住的焦点", () => {
  const run = runtime();
  const expected = setSource(run.nodes.a2);
  run.addon.setSourceEnabled({ on: true });
  run.controller.notebookController.focusNote = run.nodes.a2;
  run.advance(160);
  assert.equal(run.addon.__focusNextLastFocus, run.nodes.a2);
  run.controller.notebookController.focusNote = null;
  run.addon.pressOriginal(); run.addon.openOriginal();
  assert.deepEqual(run.urls, [expected], `焦点已被导航记住，却提示：${run.messages.join("；")}`);
});

for (const mode of ["emptyNotebookId", "kvcNoteId"]) {
  test(`前后切换能用的焦点也能查看原题：${mode}`, () => {
    const run = runtime();
    const expected = setSource(run.nodes.a2);
    if (mode === "emptyNotebookId") run.controller.notebookController.notebookId = "";
    if (mode === "kvcNoteId") {
      delete run.nodes.a2.noteId;
      run.nodes.a2.valueForKey = key => key === "noteId" ? "a2" : undefined;
    }
    run.addon.setSourceEnabled({ on: true });
    run.addon.focusNext();
    assert.equal(run.addon.__focusNextLastFocus, run.nodes.a2);
    run.controller.notebookController.focusNote = null;
    run.addon.pressOriginal(); run.addon.openOriginal();
    assert.deepEqual(run.urls, [expected], `切换成功，但原题提示：${run.messages.join("；")}`);
  });
}

test("总开关关闭会移除全部浮动按钮，保留子开关，重新开启恢复按钮", () => {
  const run = runtime(); setSource(run.nodes.a1);
  run.addon.setSourceEnabled({ on: true });
  run.addon.pressOriginal();
  run.addon.setFocusEnabled({ on: false });
  for (const key of ["__focusPreviousButton", "__focusNextButton", "__focusSourceButton"]) {
    assert.equal(run.addon[key].superview, undefined, key);
    assert.equal(run.addon[key].hidden, true, key);
  }
  run.addon.openOriginal(); assert.deepEqual(run.urls, []);
  assert.equal(run.context.__FOCUS_NEXT_CORE_GLOBAL__.sourceEnabled(), true);
  run.addon.setFocusEnabled({ on: true });
  for (const key of ["__focusPreviousButton", "__focusNextButton", "__focusSourceButton"]) assert.equal(run.addon[key].superview, run.controller.view);
});

test("查看原题默认关闭，服从总开关并保留设置，按钮拖动后恢复位置", () => {
  const run = runtime();
  run.addon.notebookWillOpen();
  assert.equal(run.addon.__focusSourceButton, undefined);
  run.addon.setSourceEnabled({ on: true });
  const button = run.addon.__focusSourceButton;
  assert.equal(button.title, "查看原题");
  assert.equal(button.frame.y, run.addon.__focusNextButton.frame.y + 48);
  assert.equal(button.gestures[0].selector, "handleFocusSourceButtonPan:");
  run.addon.setFocusEnabled({ on: false });
  assert.equal(run.addon.__focusNextButton.superview, undefined);
  assert.equal(button.superview, undefined);
  run.addon.setFocusEnabled({ on: true });
  assert.equal(button.superview, run.controller.view);
  const recognizer = { state: 1, translationInView() { return { x: -130, y: 60 }; }, setTranslationInView() {} };
  run.addon.handleFocusSourceButtonPan(recognizer);
  recognizer.state = 2; run.addon.handleFocusSourceButtonPan(recognizer);
  recognizer.state = 3; run.addon.handleFocusSourceButtonPan(recognizer);
  const moved = { ...button.frame };
  setSource(run.nodes.a1);
  run.addon.openOriginal();
  assert.equal(run.urls.length, 0);
  run.addon.setSourceEnabled({ on: false });
  assert.equal(button.superview, undefined);
  run.addon.openOriginal(); assert.equal(run.urls.length, 0);
  run.addon.setSourceEnabled({ on: true });
  for (const key of ["x", "y", "width", "height"]) assert.ok(Math.abs(button.frame[key] - moved[key]) < 0.001);
  run.addon.setFocusEnabled({ on: false });
  const restarted = runtime(run.defaults);
  restarted.addon.notebookWillOpen();
  assert.equal(restarted.addon.__focusNextButton, undefined);
  assert.equal(restarted.addon.__focusSourceButton, undefined);
  restarted.addon.setSourceEnabled({ on: true });
  assert.equal(restarted.addon.__focusSourceButton, undefined);
  restarted.addon.setFocusEnabled({ on: true });
  for (const key of ["x", "y", "width", "height"]) assert.ok(Math.abs(restarted.addon.__focusSourceButton.frame[key] - moved[key]) < 0.001);
  restarted.controller.view.frame = { x: 0, y: 0, width: 300, height: 320 };
  restarted.advance(200);
  const frame = restarted.addon.__focusSourceButton.frame;
  assert.ok(frame.x >= 0 && frame.x + frame.width <= 300 && frame.y + frame.height <= 320);
  const menu = openMenu(restarted);
  assert.equal(menu.rows.find(row => row.key === "source").control.on, true);
  restarted.addon.notebookWillClose();
  assert.equal(restarted.addon.__focusSourceButton.superview, undefined);
});

test("原题按钮按下后选中状态清空时仍打开刚才的题卡，不误用旧焦点", () => {
  const run = runtime();
  const url = setSource(run.nodes.a2);
  run.addon.setSourceEnabled({ on: true });
  run.controller.notebookController.mindmapView.selViewLst = [{ note: run.nodes.a2 }];
  run.addon.pressOriginal();
  run.controller.notebookController.mindmapView.selViewLst = [];
  run.addon.openOriginal();
  assert.deepEqual(run.urls, [url]);
  assert.equal(run.addon.__focusNextSourcePress, null);
});

for (const entry of ["focusView", "focusNode", "keyPath"]) {
  test(`脑图焦点仅通过${entry}暴露时，未选中也能查看原题`, () => {
    const run = runtime();
    const expected = setSource(run.nodes.a2);
    run.controller.notebookController.focusNote = null;
    if (entry === "keyPath") run.controller.valueForKeyPath = path => path === "notebookController.focusNote" ? run.nodes.a2 : undefined;
    else run.controller.notebookController.mindmapView[entry] = { note: run.nodes.a2 };
    run.addon.setSourceEnabled({ on: true });
    assert.equal(run.context.__FOCUS_NEXT_CORE_GLOBAL__.currentFocus(run.addon), run.nodes.a2);
    run.addon.pressOriginal(); run.addon.openOriginal();
    assert.deepEqual(run.urls, [expected]);
    assert.deepEqual(run.messages, []);
    run.controller.notebookController.mindmapView[entry] = null;
    run.controller.valueForKeyPath = undefined;
    run.addon.openOriginal();
    assert.equal(run.urls.length, 2);
    run.addon.notebookWillClose(); run.addon.notebookWillOpen();
    run.addon.openOriginal();
    assert.equal(run.urls.length, 2);
    assert.match(run.messages[0], /选中.*焦点/);
  });
}

test("按下后换卡、切学习集、超时或窗口切换均不误跳转", () => {
  for (const mode of ["note", "notebook", "timeout", "window"]) {
    const run = runtime(); setSource(run.nodes.a1); setSource(run.nodes.a2);
    if (mode === "timeout") run.controller.notebookController.focusNote = null;
    run.addon.setSourceEnabled({ on: true });
    if (mode === "timeout") run.controller.notebookController.mindmapView.selViewLst = [{ note: run.nodes.a1 }];
    run.addon.pressOriginal();
    if (mode === "note") run.controller.notebookController.focusNote = run.nodes.a2;
    if (mode === "notebook") { run.controller.notebookController.notebookId = "another"; run.controller.notebookController.focusNote = null; }
    if (mode === "timeout") { run.controller.notebookController.mindmapView.selViewLst = []; run.advance(801); }
    if (mode === "window") {
      const app = run.context.Application.sharedInstance(); app.focusWindow = {};
      run.context.Application.sharedInstance = () => app;
    }
    run.addon.openOriginal();
    assert.deepEqual(run.urls, [], mode);
    assert.ok(run.messages.length, mode);
  }
});

test("未记录当前学习集焦点时不借用无归属记忆，多选及普通卡片给出提示", () => {
  const run = runtime(); setSource(run.nodes.a1);
  run.controller.notebookController.focusNote = null;
  run.addon.setSourceEnabled({ on: true });
  run.addon.__focusNextLastFocus = run.nodes.a1;
  run.addon.openOriginal(); assert.match(run.messages.pop(), /选中.*焦点/);
  run.controller.notebookController.mindmapView.selViewLst = [{ note: run.nodes.a1 }, { note: run.nodes.a2 }];
  run.addon.openOriginal(); assert.match(run.messages.pop(), /只选中一张/);
  run.controller.notebookController.mindmapView.selViewLst = [{ note: run.nodes.b }];
  run.addon.openOriginal(); assert.match(run.messages.pop(), /没有有效原题链接/);
  assert.deepEqual(run.urls, []);
});

test("查看原题的焦点记忆跟随前后切换，跨学习集和关闭生命周期均不沿用", () => {
  for (const mode of ["notebookId", "open", "close", "disconnect", "disabled"]) {
    const run = runtime();
    const expected = setSource(run.nodes.a2);
    run.addon.setSourceEnabled({ on: true });
    run.addon.focusNext();
    run.controller.notebookController.focusNote = null;
    run.addon.openOriginal();
    assert.deepEqual(run.urls, [expected], mode);
    if (mode === "notebookId") run.controller.notebookController.notebookId = "another";
    if (mode === "open") run.addon.notebookWillOpen();
    if (mode === "close") { run.addon.notebookWillClose(); run.addon.notebookWillOpen(); }
    if (mode === "disconnect") { run.addon.sceneDidDisconnect(); run.addon.sceneWillConnect(); run.addon.notebookWillOpen(); }
    if (mode === "disabled") { run.addon.setFocusEnabled({ on: false }); run.addon.setFocusEnabled({ on: true }); }
    run.addon.openOriginal();
    assert.equal(run.urls.length, 1, mode);
    assert.match(run.messages.pop(), /选中.*焦点/, mode);
  }
});

test("损坏链接、多个不同入口和题目身份冲突均停止，不改写题卡", () => {
  for (const mode of ["invalid", "duplicate", "identity", "provider", "legacy"]) {
    const run = runtime(); setSource(run.nodes.a1);
    if (mode === "invalid") setSource(run.nodes.a1, "yankean-bridge?action=open&source=cse408&question=42");
    if (mode === "duplicate") run.nodes.a1.comments.push({ text: "[查看原题](marginnote4app://addon/yankean-bridge?action=open&source=math&question=43)" });
    if (mode === "identity") setSource(run.nodes.a1, sourceCases[2][1], "YANKEAN_QUESTION:43");
    if (mode === "provider") setSource(run.nodes.a1, sourceCases[2][1], "DAGUANYUAN_QUESTION_ID:42");
    if (mode === "legacy") run.nodes.a1.comments = [{ text: "[查看原题](https://bbkaoyan.cn/questions/42)" }];
    const before = JSON.stringify(run.nodes.a1.comments);
    run.addon.setSourceEnabled({ on: true }); run.addon.openOriginal();
    assert.deepEqual(run.urls, [], mode);
    assert.ok(run.messages.length, mode);
    assert.equal(JSON.stringify(run.nodes.a1.comments), before);
  }
});
