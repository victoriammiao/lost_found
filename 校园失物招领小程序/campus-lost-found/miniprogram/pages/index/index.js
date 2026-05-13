// pages/index/index.js
const { request } = require("../../utils/request.js");
const config = require("../../utils/config.js");

/** 地点 Tab 与地点库 place id 对应（与 backend/data/scnu_nanhai_locations.json 一致） */
const LOC_CLASSROOM_IDS = new Set([
  "teaching_main_a",
  "teaching_main_b",
  "teaching_main_c",
  "teaching_lab",
  "teaching_software",
  "teaching_Comprehensive",
  "teaching_admin",
  "teaching_interenational_business",
]);
const LOC_LIBRARY_IDS = new Set(["teaching_lib"]);
const LOC_CANTEEN_IDS = new Set(["living_canteen_1"]);
const LOC_DORM_IDS = new Set([
  "dorm_1",
  "dorm_2",
  "dorm_3",
  "dorm_4",
  "dorm_5",
  "dorm_6",
  "dorm_7",
  "dorm_8",
]);
const LOC_SPORTS_IDS = new Set([
  "sports_track",
  "sports_gym",
  "sports_basketball",
  "sports_tennis",
]);
const LOC_GATE_IDS = new Set(["Southeast_Gate", "North_Gate"]);

const LOCATION_TABS = [
  { id: "all", label: "全部" },
  { id: "classroom", label: "教学楼" },
  { id: "library", label: "图书馆" },
  { id: "canteen", label: "食堂" },
  { id: "dorm", label: "宿舍" },
  { id: "sports", label: "操场" },
  { id: "gate", label: "校门" },
];

const STATUS_TABS = [
  { id: "all", label: "全部" },
  { id: "lost", label: "寻物" },
  { id: "found", label: "招领" },
  { id: "claimed", label: "已认领" },
];

function cmpCreateTimeDesc(a, b) {
  const ta = a.createTime || "";
  const tb = b.createTime || "";
  if (tb !== ta) return tb < ta ? -1 : tb > ta ? 1 : 0;
  return (b.id || 0) - (a.id || 0);
}

function sortOpenItems(list) {
  return list.slice().sort((a, b) => {
    const va = a.publisherStudentVerified ? 1 : 0;
    const vb = b.publisherStudentVerified ? 1 : 0;
    if (vb !== va) return vb - va;
    return cmpCreateTimeDesc(a, b);
  });
}

function sortClaimedItems(list) {
  return list.slice().sort(cmpCreateTimeDesc);
}

/** 未认领在前、已认领在后（信息流主序） */
function sortFeedDefault(list) {
  const open = list.filter((it) => it.status !== "已认领");
  const done = list.filter((it) => it.status === "已认领");
  return sortOpenItems(open).concat(sortClaimedItems(done));
}

function matchesLocationTab(item, locTab) {
  if (locTab === "all") return true;
  const pid = (item.locationId || "").trim();
  if (!pid) return false;
  if (locTab === "classroom") return LOC_CLASSROOM_IDS.has(pid);
  if (locTab === "library") return LOC_LIBRARY_IDS.has(pid);
  if (locTab === "canteen") return LOC_CANTEEN_IDS.has(pid);
  if (locTab === "dorm") return LOC_DORM_IDS.has(pid);
  if (locTab === "sports") return LOC_SPORTS_IDS.has(pid);
  if (locTab === "gate") return LOC_GATE_IDS.has(pid);
  return true;
}

function matchesStatusTab(item, statusTab) {
  if (statusTab === "all") return true;
  if (statusTab === "lost") return item.postType === "寻物";
  if (statusTab === "found") return item.postType === "招领";
  if (statusTab === "claimed") return item.status === "已认领";
  return true;
}

/** 标题 + 描述联合检索；空格分词，命中任一词即展示（OR） */
function matchesSearch(item, raw) {
  const q = String(raw || "").trim();
  if (!q) return true;
  const hay = `${item.title || ""}\n${item.description || ""}`.toLowerCase();
  const parts = q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return true;
  return parts.some((p) => hay.indexOf(p) !== -1);
}

Page({
  data: {
    username: "",
    loading: false,
    searchKeyword: "",
    statusTab: "all",
    locTab: "all",
    statusTabs: STATUS_TABS,
    locationTabs: LOCATION_TABS,
    displayItems: [],
    itemsEmpty: true,
    filteredEmpty: false,
  },

  _itemsAll: [],

  onLoad() {
    this._pageDestroyed = false;
  },

  onUnload() {
    this._pageDestroyed = true;
  },

  onShow() {
    const token = wx.getStorageSync("token");
    if (!token) {
      wx.reLaunch({ url: "/pages/login/login" });
      return;
    }
    this.setData({ username: wx.getStorageSync("username") || "" });
    this.loadItems();
  },

  onPullDownRefresh() {
    this.loadItems().then(() => wx.stopPullDownRefresh());
  },

  applyFilters() {
    const { searchKeyword, statusTab, locTab } = this.data;
    let list = this._itemsAll.slice();
    list = list.filter((it) => matchesStatusTab(it, statusTab));
    list = list.filter((it) => matchesLocationTab(it, locTab));
    list = list.filter((it) => matchesSearch(it, searchKeyword));

    let displayItems;
    if (statusTab === "claimed") {
      displayItems = sortClaimedItems(list);
    } else {
      displayItems = sortFeedDefault(list);
    }

    const filteredEmpty =
      displayItems.length === 0 &&
      (searchKeyword.trim() !== "" || statusTab !== "all" || locTab !== "all");

    if (this._pageDestroyed) return;
    this.setData({
      displayItems,
      itemsEmpty: this._itemsAll.length === 0,
      filteredEmpty,
    });
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value || "" });
    this.applyFilters();
  },

  onSearchConfirm() {
    this.applyFilters();
  },

  onPickStatusTab(e) {
    const id = e.currentTarget.dataset.id;
    if (!id || id === this.data.statusTab) return;
    this.setData({ statusTab: id });
    this.applyFilters();
  },

  onPickLocTab(e) {
    const id = e.currentTarget.dataset.id;
    if (!id || id === this.data.locTab) return;
    this.setData({ locTab: id });
    this.applyFilters();
  },

  async loadItems() {
    if (this._pageDestroyed) return;
    this.setData({ loading: true });
    try {
      const res = await request({ url: "/items", method: "GET" });
      if (this._pageDestroyed) return;
      const ok = res && Number(res.code) === 0 && Array.isArray(res.data);
      if (ok) {
        const list = res.data.map((it) => {
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
            locationId: (it.locationId || "").trim(),
            publisherStudentVerified: !!it.publisherStudentVerified,
          });
        });
        this._itemsAll = list;
        this.applyFilters();
      } else {
        const msg = (res && res.message) || "列表加载失败";
        wx.showToast({ title: msg, icon: "none" });
        this._itemsAll = [];
        if (!this._pageDestroyed) {
          this.setData({
            displayItems: [],
            itemsEmpty: true,
            filteredEmpty: false,
          });
        }
      }
    } catch (e) {
      // request 已处理
    } finally {
      if (!this._pageDestroyed) this.setData({ loading: false });
    }
  },

  goClueSubmit(e) {
    const status = e.currentTarget.dataset.status;
    if (status === "已认领") return;
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({
      url: "/pages/clue-submit/clue-submit?itemId=" + id,
    });
  },

  goPublish() {
    wx.navigateTo({ url: "/pages/publish/publish" });
  },

  goHome() {
    this.loadItems();
  },

  goProfile() {
    wx.navigateTo({ url: "/pages/profile/profile" });
  },

  logout() {
    wx.showModal({
      title: "退出登录",
      content: "确定退出当前账号吗?",
      success: (r) => {
        if (!r.confirm) return;
        wx.removeStorageSync("token");
        wx.removeStorageSync("username");
        wx.reLaunch({ url: "/pages/login/login" });
      },
    });
  },
});
