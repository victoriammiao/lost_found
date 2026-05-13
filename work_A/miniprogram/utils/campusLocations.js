// 将后端 GET /locations 返回的 payload 展平，供关键词筛选

function buildFlatPlaces(payload) {
  const list = [];
  const zones = (payload && payload.zones) || [];
  zones.forEach((z) => {
    const zname = z.name || "";
    (z.places || []).forEach((p) => {
      const pname = p.name || "";
      const label = `${zname} · ${pname}`;
      const parts = [label, zname, pname, ...(p.keywords || [])];
      const rawLat =
        p.lat != null && p.lat !== ""
          ? p.lat
          : p.latitude != null && p.latitude !== ""
            ? p.latitude
            : null;
      const rawLng =
        p.lng != null && p.lng !== ""
          ? p.lng
          : p.longitude != null && p.longitude !== ""
            ? p.longitude
            : null;
      const lat = rawLat != null ? Number(rawLat) : null;
      const lng = rawLng != null ? Number(rawLng) : null;
      list.push({
        id: p.id,
        label,
        zoneName: zname,
        placeName: pname,
        searchText: parts.join(" ").toLowerCase(),
        lat: lat != null && !isNaN(lat) ? lat : null,
        lng: lng != null && !isNaN(lng) ? lng : null,
      });
    });
  });
  return list;
}

module.exports = { buildFlatPlaces };
