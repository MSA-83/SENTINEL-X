import * as Cesium from "cesium"
import "maplibre-gl/dist/maplibre-gl.css"

const viewer = new Cesium.Viewer('app', {
  timeline: false,
  animation: false
})

viewer.scene.globe.enableLighting = true
