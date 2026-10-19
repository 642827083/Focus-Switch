var __FOCUS_NEXT_ICONS_GLOBAL__ = (function () {
  function image(addon, name) {
    if (!addon || !addon.__focusNextMainPath) return null;
    const path = `${String(addon.__focusNextMainPath).replace(/\/+$/, "")}/button-icons/${name}.png`;
    const cache = addon.__focusNextIconImages || (addon.__focusNextIconImages = {});
    if (Object.prototype.hasOwnProperty.call(cache, path)) return cache[path];
    try {
      if (typeof UIImage === "undefined" || typeof UIImage.imageWithDataScale !== "function" ||
        typeof NSData === "undefined" || typeof NSData.dataWithContentsOfFile !== "function") return null;
      const data = NSData.dataWithContentsOfFile(path);
      // 安装包内使用三倍分辨率的 PNG，原生显示尺寸为 24 点。
      const result = data && UIImage.imageWithDataScale(data, 3);
      if (!result) throw new Error("图标资源不可用");
      cache[path] = result;
      return result;
    } catch (error) {
      cache[path] = null;
      console.log(`[Focus Switch] 加载图标失败，使用文字按钮：${name}；${error && error.message || error}`);
      return null;
    }
  }

  return { image };
})();
