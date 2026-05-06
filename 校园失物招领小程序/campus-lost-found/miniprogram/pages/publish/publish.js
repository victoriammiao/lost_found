// pages/publish/publish.js
// 【本次修改】在原有 title + description 发布逻辑上增加: 选图片 / 预览 / 删除 / 上传
const { request, uploadFile } = require("../../utils/request.js");

Page({
  data: {
    title: "",
    description: "",
    // 【本次新增】本地选中的图片临时路径 (上传前的 wx.chooseMedia 返回值)
    // 为空串表示用户未选择图片 (仍然允许发布)
    imagePath: "",
    loading: false,
  },

  onShow() {
    // 登录拦截: 没有 token 就踢回登录页
    const token = wx.getStorageSync("token");
    if (!token) {
      wx.reLaunch({ url: "/pages/login/login" });
    }
  },

  onInputTitle(e) {
    this.setData({ title: e.detail.value });
  },

  onInputDescription(e) {
    this.setData({ description: e.detail.value });
  },

  // 【本次新增】选择图片: 相册 或 拍照, 单张
  onChooseImage() {
    const self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"],
      success(res) {
        const file = res.tempFiles && res.tempFiles[0];
        if (file && file.tempFilePath) {
          self.setData({ imagePath: file.tempFilePath });
        }
      },
      fail(err) {
        // 用户主动取消不提示, 其它错误才提示
        if (err && err.errMsg && err.errMsg.indexOf("cancel") === -1) {
          wx.showToast({ title: "选择图片失败", icon: "none" });
        }
      },
    });
  },

  // 【本次新增】点击预览大图
  onPreviewImage() {
    const { imagePath } = this.data;
    if (!imagePath) return;
    wx.previewImage({ urls: [imagePath], current: imagePath });
  },

  // 【本次新增】删除已选图片 (点击右上角 × 触发)
  onDeleteImage() {
    this.setData({ imagePath: "" });
  },

  async onSubmit() {
    const { title, description, imagePath } = this.data;
    if (!title.trim()) {
      wx.showToast({ title: "请输入标题", icon: "none" });
      return;
    }
    if (!description.trim()) {
      wx.showToast({ title: "请输入描述", icon: "none" });
      return;
    }

    this.setData({ loading: true });

    try {
      // 第一步: 如果选了图, 先上传图片拿到 imageUrl; 没选图就跳过
      let imageUrl = "";
      if (imagePath) {
        try {
          const uploadRes = await uploadFile({
            url: "/upload",
            filePath: imagePath,
            name: "file",
          });
          if (
            uploadRes &&
            uploadRes.code === 0 &&
            uploadRes.data &&
            uploadRes.data.imageUrl
          ) {
            imageUrl = uploadRes.data.imageUrl;
          } else {
            wx.showToast({
              title: (uploadRes && uploadRes.message) || "图片上传失败",
              icon: "none",
            });
            this.setData({ loading: false });
            return;
          }
        } catch (e) {
          // 网络失败, uploadFile 已经弹过 toast, 这里直接中止发布
          this.setData({ loading: false });
          return;
        }
      }

      // 第二步: 调用发布接口, 带上 imageUrl (可能是空串)
      const res = await request({
        url: "/items",
        method: "POST",
        data: {
          title: title.trim(),
          description: description.trim(),
          imageUrl: imageUrl,
        },
      });
      if (res.code === 0) {
        wx.showToast({ title: "发布成功", icon: "success" });
        // 发布后清空已选图片, 避免返回再进入时仍有遗留
        this.setData({ imagePath: "" });
        setTimeout(() => {
          // 返回首页并触发刷新 (onShow 会重新加载列表)
          wx.navigateBack({
            fail: () => wx.reLaunch({ url: "/pages/index/index" }),
          });
        }, 600);
      } else {
        wx.showToast({ title: res.message || "发布失败", icon: "none" });
      }
    } catch (e) {
      // request 已处理
    } finally {
      this.setData({ loading: false });
    }
  },
});
