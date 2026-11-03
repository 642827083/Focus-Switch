var __FOCUS_NEXT_PROGRESS_GLOBAL__ = (function () {
  const SIZE = 36;

  function create() {
    const button = new UIButton({ x: 0, y: 0, width: SIZE, height: SIZE });
    button.__focusNextProgress = true;
    button.__focusNextIconMode = true;
    button.backgroundColor = UIColor.whiteColor();
    button.layer.cornerRadius = SIZE / 2;
    button.layer.masksToBounds = true;
    button.layer.borderWidth = 0.5;
    button.layer.borderColor = UIColor.lightGrayColor();
    button.setTitleColorForState(UIColor.darkGrayColor(), 0);
    button.titleLabel.font = UIFont.boldSystemFontOfSize(12);
    button.titleLabel.numberOfLines = 1;
    button.setTitleForState("—", 0);
    // 用原生图层绘制细圆环，数字由按钮标题显示；不引入网页或逐帧定时器。
    if (typeof CAShapeLayer !== "undefined" && typeof CAShapeLayer.layer === "function" &&
      typeof UIBezierPath !== "undefined" && typeof UIBezierPath.bezierPathWithArcCenterRadiusStartAngleEndAngleClockwise === "function" &&
      typeof button.layer.addSublayer === "function") {
      try {
        const path = UIBezierPath.bezierPathWithArcCenterRadiusStartAngleEndAngleClockwise({ x: 18, y: 18 }, 14.5, -Math.PI / 2, Math.PI * 1.5, true);
        if (!path) return button;
        const rings = [CAShapeLayer.layer(), CAShapeLayer.layer()];
        rings.forEach(function (ring, index) {
          ring.frame = { x: 0, y: 0, width: SIZE, height: SIZE };
          // 宿主的 path setter 会内部读取 CGPath，必须传 UIBezierPath 本身。
          ring.path = path;
          ring.fillColor = UIColor.colorWithRedGreenBlueAlpha(0, 0, 0, 0);
          ring.strokeColor = index ? UIColor.colorWithRedGreenBlueAlpha(0.12, 0.42, 0.78, 1) : UIColor.colorWithRedGreenBlueAlpha(0.89, 0.90, 0.92, 1);
          ring.lineWidth = 2.5;
          ring.lineCap = "round";
          ring.strokeEnd = index ? 0 : 1;
          button.layer.addSublayer(ring);
        });
        button.__focusNextProgressRing = rings[1];
      } catch (error) { console.log(`[Focus Switch] 进度圆环暂不可用：${error && error.message || error}`); }
    }
    return button;
  }

  function refresh(addon) {
    const button = addon && addon.__focusProgressButton;
    if (!button || button.hidden || addon.focusNextEnabled === false) return;
    const state = __FOCUS_NEXT_CORE_GLOBAL__.siblingProgress(addon);
    const key = state ? state.index + "/" + state.total : "—";
    if (button.__focusNextProgressKey === key) return;
    button.__focusNextProgressKey = key;
    button.setTitleForState(state ? String(state.index) : "—", 0);
    button.titleLabel.font = UIFont.boldSystemFontOfSize(state && state.index >= 1000 ? 8 : state && state.index >= 100 ? 10 : 12);
    const ring = button.__focusNextProgressRing;
    if (ring) ring.strokeEnd = state ? state.index / state.total : 0;
  }

  function press(addon) {
    if (addon.__focusNextSuppressTap) { addon.__focusNextSuppressTap = false; return; }
    const core = __FOCUS_NEXT_CORE_GLOBAL__;
    if (addon.focusNextEnabled === false || !core.progressEnabled()) return;
    const state = core.siblingProgress(addon);
    core.showMessage(addon, state ? `同级进度：第 ${state.index}/${state.total} 张` : "请先进入一张卡片的焦点");
  }

  return { create, refresh, press };
})();
