const { request, hintFromRequestFail } = require("../../utils/request.js");
const { buildFlatPlaces } = require("../../utils/campusLocations.js");
const { findNearestPlace } = require("../../utils/geo.js");

const MAX_SNAP_METERS = 220;

Page({
  data: {
    latitude: 23.0382,
    longitude: 113.0265,
    scale: 18,
    markers: [],
    geoPlaces: [],
    showLocation: true,
    maxSnapM: MAX_SNAP_METERS,
  },

  onLoad() {
    this._pageDestroyed = false;
    this._backTimer = null;
    try {
      if (this.getOpenerEventChannel) {
        this._eventChannel = this.getOpenerEventChannel();
      }
    } catch (e) {
      this._eventChannel = null;
    }
    this.loadMapData();
  },

  onUnload() {
    this._pageDestroyed = true;
    if (this._backTimer) {
      clearTimeout(this._backTimer);
      this._backTimer = null;
    }
  },

  onReady() {
    this._mapCtx = wx.createMapContext("campusMap", this);
  },

  async loadMapData() {
    try {
      const res = await request({
        url: "/locations",
        method: "GET",
        failToast: false,
      });
      if (this._pageDestroyed) return;
      if (res.code !== 0 || !res.data) {
        wx.showToast({ title: (res && res.message) || "加载失败", icon: "none" });
        if (this._backTimer) clearTimeout(this._backTimer);
        this._backTimer = setTimeout(() => {
          this._backTimer = null;
          if (!this._pageDestroyed) wx.navigateBack();
        }, 400);
        return;
      }
      const payload = res.data;
      const flat = buildFlatPlaces(payload);
      const geoPlaces = flat.filter(
        (p) =>
          p.lat != null &&
          p.lng != null &&
          !isNaN(p.lat) &&
          !isNaN(p.lng)
      );
      if (geoPlaces.length === 0) {
        wx.showModal({
          title: "暂无地图坐标",
          content:
            "地点库中尚未配置坐标。请在 data/scnu_nanhai_locations.json 为各点位写入 latitude / longitude（腾讯坐标拾取，GCJ-02）后再试。",
          showCancel: false,
          success: () => wx.navigateBack(),
        });
        return;
      }

      const md = payload.mapDefaults || {};
      let lat = Number(md.latitude);
      let lng = Number(md.longitude);
      let scale = Number(md.scale) || 18;
      if (isNaN(lat) || isNaN(lng)) {
        lat = geoPlaces[0].lat;
        lng = geoPlaces[0].lng;
      }

      const markers = geoPlaces.map((p, i) => ({
        id: i,
        latitude: p.lat,
        longitude: p.lng,
        width: 28,
        height: 36,
        title: p.placeName || "",
      }));

      if (this._pageDestroyed) return;
      this.setData({
        latitude: lat,
        longitude: lng,
        scale: scale >= 3 && scale <= 20 ? scale : 18,
        markers,
        geoPlaces,
      });
    } catch (e) {
      if (
        e &&
        (e.message === "未登录" || e.message === "登录已失效")
      ) {
        if (this._backTimer) clearTimeout(this._backTimer);
        this._backTimer = setTimeout(() => {
          this._backTimer = null;
          if (!this._pageDestroyed) wx.navigateBack();
        }, 400);
        return;
      }
      wx.showToast({
        title: hintFromRequestFail(e),
        icon: "none",
        duration: 3200,
      });
      if (this._backTimer) clearTimeout(this._backTimer);
      this._backTimer = setTimeout(() => {
        this._backTimer = null;
        if (!this._pageDestroyed) wx.navigateBack();
      }, 400);
    }
  },

  emitPick(place) {
    if (!place || !place.id || !place.label) return;
    const payload = { id: place.id, label: place.label };
    if (this._eventChannel && this._eventChannel.emit) {
      this._eventChannel.emit("locationPicked", payload);
    } else {
      wx.setStorageSync("lastMapPick", Object.assign({}, payload, { ts: Date.now() }));
    }
    wx.navigateBack();
  },

  onMarkerTap(e) {
    const mid = e.detail.markerId;
    const idx = typeof mid === "number" ? mid : parseInt(mid, 10);
    const place = this.data.geoPlaces[idx];
    if (place) {
      this.emitPick(place);
    }
  },

  onMapTap(e) {
    const det = e.detail || {};
    const lat = det.latitude;
    const lng = det.longitude;
    if (lat == null || lng == null) {
      wx.showToast({ title: "请轻触地图选点", icon: "none" });
      return;
    }
    const nearest = findNearestPlace(lat, lng, this.data.geoPlaces);
    if (!nearest || nearest.distanceM > MAX_SNAP_METERS) {
      wx.showToast({
        title: "附近无匹配标注，请靠近红点或点图标（约" + MAX_SNAP_METERS + "米内）",
        icon: "none",
      });
      return;
    }
    this.emitPick(nearest.place);
  },

  onCancel() {
    wx.navigateBack();
  },

  onRegionChange(e) {
    const top = e.detail || {};
    const inner = top.detail || {};
    const sc =
      inner.scale != null && !isNaN(inner.scale)
        ? inner.scale
        : top.scale != null && !isNaN(top.scale)
          ? top.scale
          : null;
    if (top.type === "end" && sc != null) {
      const s = Math.round(Number(sc));
      if (s >= 3 && s <= 20 && s !== this.data.scale) {
        if (!this._pageDestroyed) this.setData({ scale: s });
      }
    }
  },

  _applyZoomStep(delta) {
    this._zoomPendingDelta = (this._zoomPendingDelta || 0) + delta;
    if (this._zoomInFlight) return;
    this._zoomInFlight = true;
    const run = () => {
      if (this._pageDestroyed) {
        this._zoomInFlight = false;
        this._zoomPendingDelta = 0;
        return;
      }
      const d = this._zoomPendingDelta;
      this._zoomPendingDelta = 0;
      if (d === 0) {
        this._zoomInFlight = false;
        return;
      }
      const ctx = this._mapCtx || wx.createMapContext("campusMap", this);
      this._mapCtx = ctx;
      const fallback = Math.round(this.data.scale || 18);
      ctx.getScale({
        success: (res) => {
          if (this._pageDestroyed) {
            this._zoomInFlight = false;
            return;
          }
          let cur = res && typeof res.scale === "number" ? res.scale : fallback;
          if (isNaN(cur)) cur = fallback;
          cur = Math.round(cur);
          const s = Math.min(20, Math.max(3, cur + d));
          this.setData({ scale: s }, run);
        },
        fail: () => {
          if (this._pageDestroyed) {
            this._zoomInFlight = false;
            return;
          }
          const s = Math.min(20, Math.max(3, fallback + d));
          this.setData({ scale: s }, run);
        },
      });
    };
    run();
  },

  onZoomIn() {
    this._applyZoomStep(1);
  },

  onZoomOut() {
    this._applyZoomStep(-1);
  },
});
