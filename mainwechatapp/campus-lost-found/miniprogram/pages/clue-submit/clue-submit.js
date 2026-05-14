const { request, uploadFile } = require("../../utils/request.js");

Page({
  data: {
    itemId: null,
    peek: null,
    contact: "",
    foundLocation: "",
    foundTime: "",
    description: "",
    imagePath: "",
    pickedLocalPath: "",
    loading: false,
  },

  onUnload() {
    this._pageDestroyed = true;
    if (this._backTimer) {
      clearTimeout(this._backTimer);
      this._backTimer = null;
    }
  },

  onLoad(options) {
    this._pageDestroyed = false;
    const raw = options && options.itemId;
    const id = parseInt(raw, 10);
    if (isNaN(id)) {
      wx.showToast({ title: "参数错误", icon: "none" });
      this._backTimer = setTimeout(() => {
        this._backTimer = null;
        if (!this._pageDestroyed) wx.navigateBack();
      }, 400);
      return;
    }
    this.setData({ itemId: id });
    this.loadPeek();
  },

  onShow() {
    const lp = wx.getStorageSync("lastMapPick");
    if (
      lp &&
      lp.id &&
      lp.label &&
      lp.ts &&
      Date.now() - lp.ts < 120000
    ) {
      if (!this._pageDestroyed) {
        const label = String(lp.label || "").slice(0, 200);
        this.setData({ foundLocation: label });
      }
      wx.removeStorageSync("lastMapPick");
    }
  },

  goMapPickFound() {
    wx.navigateTo({
      url: "/pages/map-picker/map-picker",
      events: {
        locationPicked: (data) => {
          if (this._pageDestroyed || !data || !data.label) return;
          const label = String(data.label || "").slice(0, 200);
          this.setData({ foundLocation: label });
        },
      },
    });
  },

  async loadPeek() {
    try {
      const res = await request({
        url: "/items/" + this.data.itemId + "/peek",
        method: "GET",
      });
      if (this._pageDestroyed) return;
      if (Number(res.code) === 0 && res.data) {
        if (!this._pageDestroyed) this.setData({ peek: res.data });
      } else {
        wx.showToast({ title: (res && res.message) || "无法打开", icon: "none" });
        if (this._backTimer) clearTimeout(this._backTimer);
        this._backTimer = setTimeout(() => {
          this._backTimer = null;
          if (!this._pageDestroyed) wx.navigateBack();
        }, 500);
      }
    } catch (e) {
      wx.showToast({ title: "网络错误", icon: "none" });
      if (this._backTimer) clearTimeout(this._backTimer);
      this._backTimer = setTimeout(() => {
        this._backTimer = null;
        if (!this._pageDestroyed) wx.navigateBack();
      }, 500);
    }
  },

  onInputContact(e) {
    this.setData({ contact: e.detail.value || "" });
  },
  onInputFoundLoc(e) {
    this.setData({ foundLocation: e.detail.value || "" });
  },
  onInputFoundTime(e) {
    this.setData({ foundTime: e.detail.value || "" });
  },
  onInputDesc(e) {
    this.setData({ description: e.detail.value || "" });
  },

  onChooseImage() {
    const self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"],
      success(res) {
        if (self._pageDestroyed) return;
        const file = res.tempFiles && res.tempFiles[0];
        if (file && file.tempFilePath) {
          self.setData({
            imagePath: file.tempFilePath,
            pickedLocalPath: file.tempFilePath,
          });
        }
      },
      fail(err) {
        if (err && err.errMsg && err.errMsg.indexOf("cancel") === -1) {
          wx.showToast({ title: "选择图片失败", icon: "none" });
        }
      },
    });
  },

  onPreview() {
    const { imagePath } = this.data;
    if (!imagePath) return;
    wx.previewImage({ urls: [imagePath], current: imagePath });
  },

  onClearImage() {
    this.setData({ imagePath: "", pickedLocalPath: "" });
  },

  async onSubmit() {
    const { contact, foundLocation, foundTime, description, itemId, pickedLocalPath } =
      this.data;
    if (!(contact || "").trim() || (contact || "").trim().length < 3) {
      wx.showToast({ title: "请填写联系方式", icon: "none" });
      return;
    }
    if (!(foundLocation || "").trim()) {
      wx.showToast({ title: "请填写地点", icon: "none" });
      return;
    }
    if (!(foundTime || "").trim()) {
      wx.showToast({ title: "请填写时间", icon: "none" });
      return;
    }
    if (!(description || "").trim()) {
      wx.showToast({ title: "请填写说明", icon: "none" });
      return;
    }

    this.setData({ loading: true });
    try {
      let imageUrl = "";
      if (pickedLocalPath) {
        const up = await uploadFile({
          url: "/upload",
          filePath: pickedLocalPath,
          name: "file",
        });
        if (!up || Number(up.code) !== 0 || !up.data || !up.data.imageUrl) {
          wx.showToast({ title: (up && up.message) || "图片上传失败", icon: "none" });
          if (!this._pageDestroyed) this.setData({ loading: false });
          return;
        }
        imageUrl = up.data.imageUrl;
      }

      const res = await request({
        url: "/items/" + itemId + "/clues",
        method: "POST",
        data: {
          contact: (contact || "").trim(),
          foundLocation: (foundLocation || "").trim(),
          foundTime: (foundTime || "").trim(),
          description: (description || "").trim(),
          imageUrl: imageUrl || "",
        },
      });
      if (Number(res.code) === 0) {
        wx.showToast({ title: res.message || "已提交", icon: "success" });
        if (this._backTimer) clearTimeout(this._backTimer);
        this._backTimer = setTimeout(() => {
          this._backTimer = null;
          if (!this._pageDestroyed) wx.navigateBack();
        }, 500);
      } else {
        wx.showToast({ title: res.message || "提交失败", icon: "none" });
      }
    } catch (e) {
    } finally {
      if (!this._pageDestroyed) this.setData({ loading: false });
    }
  },
});
