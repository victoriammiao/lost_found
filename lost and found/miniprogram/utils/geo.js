// GCJ-02 近似球面距离（米），适用于校区尺度

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** @param {Array<{lat:number,lng:number,id:string,label:string}>} places */
function findNearestPlace(lat, lng, places) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < places.length; i++) {
    const p = places[i];
    if (p.lat == null || p.lng == null || isNaN(p.lat) || isNaN(p.lng)) continue;
    const d = distanceMeters(lat, lng, p.lat, p.lng);
    if (d < bestD) {
      bestD = d;
      best = { place: p, distanceM: d };
    }
  }
  return best;
}

module.exports = { distanceMeters, findNearestPlace };
