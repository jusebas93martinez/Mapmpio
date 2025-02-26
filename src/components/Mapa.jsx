import { useEffect } from "react";
import PropTypes from "prop-types";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import departamentos from "/departamentos.geojson?url";
import municipios from "/municipios.json?url";

const Mapa = ({ setSelectedFeature }) => {
  useEffect(() => {
    const newMap = new maplibregl.Map({
      container: "map",
      style:
        "https://api.maptiler.com/maps/satellite/style.json?key=Wnai4G4s1koZsp2dtjyh",
      center: [-74.2973, 4.5709],
      zoom: 4,
      projection: "globe",
    });

    newMap.on("style.load", () => {
      newMap.setProjection({ type: "globe" });

      // 🌌 Agregar cielo y atmósfera
      newMap.addLayer({
        id: "sky",
        type: "sky",
        paint: {
          "sky-type": "atmosphere",
          "sky-atmosphere-sun": [1.5, 90],
          "sky-atmosphere-sun-intensity": 10,
          "sky-atmosphere-color": "#88aaff",
        },
      });

      // 🔆 Configuración de la luz
      newMap.setLight({
        anchor: "map",
        position: [1.5, 90, 80],
        intensity: 1.5,
      });
    });

    newMap.on("load", () => {
      // Fuente de Municipios
      newMap.addSource("municipios", { type: "geojson", data: municipios });

      // 🔹 Capa de municipios (relleno transparente)
      newMap.addLayer({
        id: "municipios-fill",
        type: "fill",
        source: "municipios",
        paint: {
          "fill-color": "#ffffff",
          "fill-opacity": 0.02, // Muy transparente
        },
      });

      // 🔹 Capa de bordes de municipios (Gris)
      newMap.addLayer({
        id: "municipios-borders",
        type: "line",
        source: "municipios",
        paint: {
          "line-color": "#888888", // Gris
          "line-width": 1,
        },
      });

      // Fuente de Departamentos (queda encima)
      newMap.addSource("departamentos", {
        type: "geojson",
        data: departamentos,
      });
      newMap.addLayer({
        id: "departamentos-layer",
        type: "line",
        source: "departamentos",
        paint: {
          "line-color": "#ffffff",
          "line-width": 2,
        },
      });

      // 🔹 Capa de selección (AZUL con borde azul oscuro)
      newMap.addLayer({
        id: "municipio-highlight",
        type: "fill",
        source: "municipios",
        paint: {
          "fill-color": "#007bff", // Azul
          "fill-opacity": 0.4,
          "fill-outline-color": "#0056b3", // Azul oscuro
        },
        filter: ["==", "MpCodigo", ""],
      });

      // 🔹 Capa de borde azul oscuro al seleccionar
      newMap.addLayer({
        id: "municipio-highlight-border",
        type: "line",
        source: "municipios",
        paint: {
          "line-color": "#0056b3", // Azul oscuro
          "line-width": 2,
        },
        filter: ["==", "MpCodigo", ""],
      });

      // Cambiar cursor sobre municipios
      newMap.on("mouseenter", "municipios-fill", () => {
        newMap.getCanvas().style.cursor = "crosshair";
      });

      newMap.on("mouseleave", "municipios-fill", () => {
        newMap.getCanvas().style.cursor = "";
      });

      // Seleccionar municipio al hacer clic (desvanece en 2 seg)
      newMap.on("click", "municipios-fill", (e) => {
        const feature = e.features[0]?.properties;
        if (feature) {
          setSelectedFeature({
            MpCodigo: feature.MpCodigo,
            MpNombre: feature.MpNombre,
            MpArea: feature.MpArea,
            MpAltitud: feature.MpAltitud,
            Depto: feature.Depto,
          });

          // Resaltar azul y agregar borde azul oscuro
          newMap.setFilter("municipio-highlight", [
            "==",
            "MpCodigo",
            feature.MpCodigo,
          ]);
          newMap.setFilter("municipio-highlight-border", [
            "==",
            "MpCodigo",
            feature.MpCodigo,
          ]);

          // 🔹 Desvanecer después de 2 segundos
          setTimeout(() => {
            newMap.setFilter("municipio-highlight", ["==", "MpCodigo", ""]);
            newMap.setFilter("municipio-highlight-border", [
              "==",
              "MpCodigo",
              "",
            ]);
          }, 2000);
        }
      });
    });

    return () => newMap.remove();
  }, [setSelectedFeature]);

  return <div id="map" className="map-container"></div>;
};

Mapa.propTypes = {
  setSelectedFeature: PropTypes.func.isRequired,
};

export default Mapa;
