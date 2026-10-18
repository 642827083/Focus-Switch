import vm from "node:vm";
import { readFileSync } from "node:fs";

function tree() {
  const notes = ["root", "a", "a1", "a2", "b", "b1"].map(noteId => ({ noteId }));
  const [root, a, a1, a2, b, b1] = notes;
  for (const [parent, children] of [[root, [a, b]], [a, [a1, a2]], [b, [b1]]]) {
    parent.childNotes = children;
    children.forEach(note => { note.parentNote = parent; });
  }
  return { root, a, a1, a2, b, b1, notes };
}

export function runtime(defaults = {}, width = 1024, height = 768) {
  class View {
    constructor(frame) { this.frame = frame; this.layer = {}; this.subviews = []; this.hidden = false; }
    get bounds() { return { x: 0, y: 0, width: this.frame.width, height: this.frame.height }; }
    addSubview(view) { view.removeFromSuperview(); this.subviews.push(view); view.superview = this; }
    removeFromSuperview() {
      if (this.superview) this.superview.subviews = this.superview.subviews.filter(view => view !== this);
      this.superview = undefined;
    }
    addGestureRecognizer(recognizer) { (this.gestures ||= []).push(recognizer); recognizer.view = this; }
    addTargetActionForControlEvents(target, selector, event) { this.target = target; this.selector = selector; this.event = event; }
  }
  class Button extends View {
    constructor(frame) { super(frame); this.titleLabel = {}; }
    setTitleForState(title) { this.title = title; }
    setTitleColorForState() {}
  }
  let now = 0;
  const timers = [], messages = [], calls = [], urls = [];
  const nodes = tree();
  const controller = {
    view: new View({ x: 0, y: 0, width, height }),
    notebookController: { focusNote: nodes.a1, notebookId: "study-set", mindmapView: { selViewLst: [] }, changeFocusToNote(note) { calls.push(`change:${note.noteId}`); this.focusNote = note; } },
    focusNoteInMindMapById(id) { calls.push(`locate:${id}`); },
    refreshAddonCommands() { calls.push("refresh-toolbar"); },
  };
  const color = { colorWithAlphaComponent() { return this; } };
  const context = {
    console, Date: { now() { return now; } },
    Application: { sharedInstance() { return { focusWindow: context.self && context.self.window, studyController() { return controller; }, showHUD(message) { messages.push(message); }, openURL(url) { urls.push(url.absoluteString); } }; } },
    NSURL: { URLWithString(text) { return { absoluteString: text }; } },
    NSData: { dataWithContentsOfFile(path) {
      if (path !== "/focus-switch-test/mnaddon.json") throw new Error("测试中的插件清单路径不正确");
      return readFileSync(new URL("../../src/mnaddon.json", import.meta.url));
    } },
    NSJSONSerialization: { JSONObjectWithDataOptions(data) { return JSON.parse(String(data)); } },
    NSUserDefaults: { standardUserDefaults() { return {
      objectForKey(key) { return defaults[key]; }, setObjectForKey(value, key) { defaults[key] = value; },
    }; } },
    UIView: View, UILabel: View, UIButton: Button, UISwitch: View, UIScrollView: View,
    UIFont: { systemFontOfSize(size) { return size; }, boldSystemFontOfSize(size) { return size; } },
    UIColor: { whiteColor() { return color; }, darkGrayColor() { return color; }, grayColor() { return color; }, lightGrayColor() { return color; }, colorWithRedGreenBlueAlpha() { return color; } },
    UIPanGestureRecognizer: class { constructor(target, selector) { this.target = target; this.selector = selector; } },
    NSTimer: { scheduledTimerWithTimeInterval(interval, repeats, callback) {
      const timer = { at: now + interval * 1000, callback, cancelled: false, invalidate() { this.cancelled = true; } };
      timers.push(timer);
      return timer;
    } },
    JSB: { defineClass(name, methods) { return methods; }, require(name) {
      vm.runInContext(readFileSync(new URL(`../../src/${name}.js`, import.meta.url), "utf8"), context);
    } },
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL("../../src/main.js", import.meta.url), "utf8"), context);
  const addon = context.JSB.newAddon("/focus-switch-test");
  addon.window = {};
  context.self = addon;
  addon.sceneWillConnect();
  function advance(milliseconds) {
    const end = now + milliseconds;
    for (let count = 0; count < 100; count++) {
      const next = timers.filter(timer => !timer.cancelled && !timer.fired && timer.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!next) { now = end; return; }
      now = next.at;
      next.fired = true;
      next.callback();
    }
    throw Error("测试中定时器未能停止");
  }
  return { context, addon, controller, defaults, nodes, timers, messages, calls, urls, advance };
}

