const { request } = require("../../utils/request.js");
const config = require("../../utils/config.js");

Page({
  data: {
    username: "",
    profile: null,
    verifyName: "",
    verifyNo: "",
    verifyLoading: false,
    published: [],
    drafts: [],
    loading: false,
  },

  onShow() {
    const token = wx.getStorageSync("token");
    if (!token) {
      wx.reLaunch({ url: "/pages/login/login" });
      return;
    }
    this.setData({ username: wx.getStorageSync("username") || "" });
    this.loadAll();
  },

  async loadAll() {
    this.setData({ loading: true });
    try {
      await Promise.all([
        this.loadProfile(),
        this.loadPublished(),
        this.loadDrafts(),
      ]);
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadProfile() {
    try {
      const res = await request({ url: "/profile", method: "GET" });
      if (res.code === 0 && res.data) {
        const d = res.data;
        if (!d.studentVerifyStatus) {
          d.studentVerifyStatus = d.studentVerified ? "approved" : "none";
        }
        this.setData({ profile: d });
      }
    } catch (e) {}
  },

  mapItems(list) {
    return (list || []).map((it) => {
      let fullUrl = "";
      if (it.imageUrl) {
        fullUrl = /^https?:\/\//.test(it.imageUrl)
          ? it.imageUrl
          : config.baseUrl + it.imageUrl;
      }
      return Object.assign({}, it, {
        imageUrl: fullUrl,
        postType: it.postType || "招领",
        locationLabel: it.locationLabel || "",
        publisherStudentVerified: !!it.publisherStudentVerified,
      });
    });
  },

  async loadPublished() {
    try {
      const res = await request({
        url: "/items/mine",
        method: "GET",
        data: { draft: "0" },
      });
      if (res.code === 0) {
        this.setData({ published: this.mapItems(res.data || []) });
      }
    } catch (e) {}
  },

  async loadDrafts() {
    try {
      const res = await request({
        url: "/items/mine",
        method: "GET",
        data: { draft: "1" },
      });
      if (res.code === 0) {
        this.setData({ drafts: this.mapItems(res.data || []) });
      }
    } catch (e) {}
  },

  onVerifyName(e) {
    this.setData({ verifyName: e.detail.value });
  },

  onVerifyNo(e) {
    this.setData({ verifyNo: e.detail.value });
  },

  async onSubmitVerify() {
    const { verifyName, verifyNo } = this.data;
    const realName = verifyName.trim();
    const studentNo = verifyNo.trim();
    if (realName.length < 2) {
      wx.showToast({ title: "请填写真实姓名", icon: "none" });
      return;
    }
    if (studentNo.length < 6) {
      wx.showToast({ title: "请填写有效学号", icon: "none" });
      return;
    }
    this.setData({ verifyLoading: true });
    try {
      const res = await request({
        url: "/profile/verify",
        method: "POST",
        data: { realName: realName, studentNo: studentNo },
      });
      if (res.code === 0) {
        wx.showToast({
          title: res.message || "已提交申请",
          icon: "success",
        });
        this.setData({ verifyName: "", verifyNo: "" });
        await this.loadProfile();
      } else {
        wx.showToast({ title: res.message || "认证失败", icon: "none" });
      }
    } catch (e) {
    } finally {
      this.setData({ verifyLoading: false });
    }
  },

  onDeletePublished(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: "删除发布",
      content: "确定删除这条已发布信息吗？",
      success: async (r) => {
        if (!r.confirm) return;
        try {
          const res = await request({
            url: "/items/" + id,
            method: "DELETE",
            data: {},
          });
          if (res.code === 0) {
            wx.showToast({ title: "已删除", icon: "success" });
            this.loadPublished();
          } else {
            wx.showToast({ title: res.message || "删除失败", icon: "none" });
          }
        } catch (e) {}
      },
    });
  },

  onDeleteDraft(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: "删除草稿",
      content: "确定删除该草稿吗？",
      success: async (r) => {
        if (!r.confirm) return;
        try {
          const res = await request({
            url: "/items/" + id,
            method: "DELETE",
            data: {},
          });
          if (res.code === 0) {
            wx.showToast({ title: "已删除", icon: "success" });
            this.loadDrafts();
          } else {
            wx.showToast({ title: res.message || "删除失败", icon: "none" });
          }
        } catch (e) {}
      },
    });
  },

  onEditDraft(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({
      url: "/pages/publish/publish?draftId=" + id,
    });
  },

  goPublish() {
    wx.navigateTo({ url: "/pages/publish/publish" });
  },

  goHome() {
    wx.reLaunch({ url: "/pages/index/index" });
  },

  goAdminVerify() {
    wx.navigateTo({ url: "/pages/admin/admin" });
  },
});
