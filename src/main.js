JSB.require("FocusNextCore");
JSB.require("FocusSwitchSource");
JSB.require("FocusSwitchComments");
JSB.require("FocusNextUI");
JSB.require("FocusSwitchSettings");
JSB.require("FocusSwitchCommands");
JSB.require("FocusNextAddon");

JSB.newAddon = function (mainPath) {
  return createFocusNextAddon(mainPath);
};
