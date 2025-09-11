function initMap(){
  state.map = L.map('map', { zoomControl:true, preferCanvas:true })
    .setView(CFG.defaultView, CFG.defaultZoom);

  // Add **multiple tile sources** as fallback
  const tiles = [
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    'https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png'
  ];
  let current = 0;

  function addLayer(url){
    return L.tileLayer(url, {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).on('tileerror', ()=> {
      current++;
      if(current < tiles.length){
        state.map.removeLayer(layer);
        layer = addLayer(tiles[current]);
        state.map.addLayer(layer);
      }
    });
  }

  let layer = addLayer(tiles[current]);
  state.map.addLayer(layer);

  // cluster layer
  state.cluster = L.markerClusterGroup({
    showCoverageOnHover:false, maxClusterRadius:50, chunkedLoading:true, spiderfyOnMaxZoom:true
  });
  state.map.addLayer(state.cluster);

  // Force resize when visible
  setTimeout(()=> state.map.invalidateSize(), 500);
}
