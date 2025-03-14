import { useEffect, useState, useRef } from "react";
import PropTypes from "prop-types";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import departamentos from "/departamentos.geojson?url";
import municipios from "/municipios.json?url";

const Mapa = ({ setSelectedFeature }) => {
  const [map, setMap] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Para la búsqueda de municipios
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredMunicipios, setFilteredMunicipios] = useState([]);
  const [municipiosData, setMunicipiosData] = useState([]);

  // Para la capa importada (GeoJSON)
  const [importedGeojson, setImportedGeojson] = useState(null);
  const [geojsonFields, setGeojsonFields] = useState([]);
  const [selectedField, setSelectedField] = useState("");
  const [showFieldSelector, setShowFieldSelector] = useState(false);

  // Info de features clickeados
  const [clickedFeatureInfo, setClickedFeatureInfo] = useState(null);

  // Para clasificación por campo
  const [colorMap, setColorMap] = useState({});
  const [geojsonLayerOpacity, setGeojsonLayerOpacity] = useState(0.4);

  // Estados DMS (solo valores positivos en los inputs)
  const [latitudeDMS, setLatitudeDMS] = useState({
    degrees: 0,
    minutes: 0,
    seconds: 0,
  });
  const [longitudeDMS, setLongitudeDMS] = useState({
    degrees: 0,
    minutes: 0,
    seconds: 0,
  });

  // Selectores de hemisferios
  const [latHemisphere, setLatHemisphere] = useState("N"); // "N" o "S"
  const [lonHemisphere, setLonHemisphere] = useState("W"); // "E" o "W"

  // Referencias
  const fileInputRef = useRef(null);
  const popupRef = useRef(null);
  const markerRef = useRef(null);

  /**
   * useEffect para inicializar el mapa y cargar datos de municipios
   * Se ejecuta SOLO UNA VEZ, sin depender de searchTerm, clickedFeatureInfo, etc.
   */
  useEffect(() => {
    // Cargar municipios
    fetch(municipios)
      .then((res) => res.json())
      .then((data) => setMunicipiosData(data.features || []));

    // Inicializar mapa
    const newMap = new maplibregl.Map({
      container: "map",
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: [-74.2973, 4.5709],
      zoom: 4,
      bearing: 0,
      pitch: 0,
      projection: "globe",
    });

    popupRef.current = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: "300px",
      className: "feature-popup",
    });

    newMap.on("load", () => {
      // Fuente y capas de municipios
      newMap.addSource("municipios", { type: "geojson", data: municipios });
      newMap.addLayer({
        id: "municipios-fill",
        type: "fill",
        source: "municipios",
        paint: { "fill-color": "#ffffff", "fill-opacity": 0.02 },
      });
      newMap.addLayer({
        id: "municipios-borders",
        type: "line",
        source: "municipios",
        paint: { "line-color": "#888888", "line-width": 1 },
      });

      // Fuente y capa de departamentos
      newMap.addSource("departamentos", {
        type: "geojson",
        data: departamentos,
      });
      newMap.addLayer({
        id: "departamentos-layer",
        type: "line",
        source: "departamentos",
        paint: { "line-color": "#ffffff", "line-width": 2 },
      });

      // Capas para resaltar municipio seleccionado
      newMap.addLayer({
        id: "municipio-highlight-fill",
        type: "fill",
        source: "municipios",
        paint: {
          "fill-color": "#808080",
          "fill-opacity": 0.1,
        },
        filter: ["==", "MpCodigo", ""],
      });
      newMap.addLayer({
        id: "municipio-highlight-border",
        type: "line",
        source: "municipios",
        paint: {
          "line-color": "#007bff",
          "line-width": 2,
        },
        filter: ["==", "MpCodigo", ""],
      });

      // Click en municipios
      newMap.on("click", "municipios-fill", (e) => {
        if (clickedFeatureInfo) {
          setClickedFeatureInfo(null);
          popupRef.current.remove();
        }
        const feature = e.features[0]?.properties;
        if (feature) {
          setSelectedFeature(feature);
          newMap.setFilter("municipio-highlight-fill", [
            "==",
            "MpCodigo",
            feature.MpCodigo,
          ]);
          newMap.setFilter("municipio-highlight-border", [
            "==",
            "MpCodigo",
            feature.MpCodigo,
          ]);
          // Si no estamos buscando nada en particular, hace zoom al municipio
          if (searchTerm === "") {
            newMap.flyTo({
              center: e.lngLat,
              zoom: 12,
            });
          }
        }
      });

      // Click en capa importada
      newMap.on("click", "imported-layer", (e) => {
        const feature = e.features[0];
        if (feature && feature.properties) {
          setClickedFeatureInfo({
            properties: feature.properties,
            coordinates: e.lngLat,
            field: selectedField,
            value: feature.properties[selectedField],
            color: getColorForValue(feature.properties[selectedField]),
          });
          const popupContent = createPopupContent(
            feature.properties,
            selectedField
          );
          popupRef.current
            .setLngLat(e.lngLat)
            .setHTML(popupContent)
            .addTo(newMap);
        }
      });
      newMap.on("mouseenter", "imported-layer", () => {
        newMap.getCanvas().style.cursor = "pointer";
      });
      newMap.on("mouseleave", "imported-layer", () => {
        newMap.getCanvas().style.cursor = "";
      });

      // Controles
      newMap.addControl(
        new maplibregl.NavigationControl({ visualizePitch: true })
      );
      newMap.addControl(new maplibregl.GlobeControl());

      // Se removieron capas de "terrainSource" para evitar errores
      setMap(newMap);
      console.log("Mapa inicializado");
    });

    return () => {
      if (popupRef.current) popupRef.current.remove();
      if (markerRef.current) markerRef.current.remove();
      newMap.remove();
    };
  }, []); // <-- Sin searchTerm ni clickedFeatureInfo en dependencias

  // ---------------------- FUNCIONES DE COORDENADAS ----------------------

  // Convierte DMS a decimal (sin signo; el signo lo definimos con el hemisferio)
  const convertDMSToDecimal = (dms) => {
    const { degrees, minutes, seconds } = dms;
    return degrees + minutes / 60 + seconds / 3600;
  };

  // Ir a coordenadas usando el hemisferio seleccionado
  const goToCoordinates = () => {
    if (map) {
      // Asignamos signo según hemisferio
      const signLat = latHemisphere === "N" ? 1 : -1;
      const signLon = lonHemisphere === "E" ? 1 : -1;

      const latitude = signLat * convertDMSToDecimal(latitudeDMS);
      const longitude = signLon * convertDMSToDecimal(longitudeDMS);

      console.log("Coordenadas calculadas: Lat:", latitude, "Long:", longitude);

      // Quitar marcador anterior
      if (markerRef.current) {
        markerRef.current.remove();
      }

      // Crear marcador personalizado
      const el = document.createElement("div");
      el.className = "custom-marker";
      el.style.width = "20px";
      el.style.height = "20px";
      el.style.backgroundColor = "red";
      el.style.borderRadius = "50%";
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 0 5px rgba(0,0,0,0.5)";
      el.style.zIndex = "9999";

      markerRef.current = new maplibregl.Marker(el)
        .setLngLat([longitude, latitude])
        .addTo(map);

      map.flyTo({
        center: [longitude, latitude],
        zoom: 10,
      });
    }
  };

  // Manejo del cambio en cada input, limitando valores (0–90 o 0–180, etc.)
  const handleCoordinateInputChange =
    (setter, field, minValue, maxValue) => (e) => {
      let value = parseInt(e.target.value, 10);
      if (isNaN(value)) {
        value = 0;
      }
      if (value < minValue) {
        value = minValue;
      } else if (value > maxValue) {
        value = maxValue;
      }
      setter((prev) => ({ ...prev, [field]: value }));
    };

  // ---------------------- BÚSQUEDA DE MUNICIPIOS ----------------------

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchTerm(query);
    if (query.length > 1) {
      const filtered = municipiosData.filter(
        (mun) =>
          mun.properties.MpNombre.toLowerCase().includes(query) ||
          mun.properties.Depto.toLowerCase().includes(query)
      );
      setFilteredMunicipios(filtered);
    } else {
      setFilteredMunicipios([]);
    }
  };

  // Al hacer clic en un municipio de la lista, vuela hacia él y resalta
  const selectMunicipio = (municipio) => {
    setSearchTerm(
      `${municipio.properties.MpNombre} - ${municipio.properties.Depto}`
    );
    setFilteredMunicipios([]);
    setSelectedFeature(municipio.properties);

    if (map) {
      map.setFilter("municipio-highlight-fill", [
        "==",
        "MpCodigo",
        municipio.properties.MpCodigo,
      ]);
      map.setFilter("municipio-highlight-border", [
        "==",
        "MpCodigo",
        municipio.properties.MpCodigo,
      ]);

      // El geometry normalmente es multipolígono.
      // Asumimos que geometry.coordinates[0][0] es un punto de ese polígono
      // y volamos ahí con un zoom de 11
      map.flyTo({
        center: municipio.geometry.coordinates[0][0],
        zoom: 11,
      });
    }
  };

  // ---------------------- CAPA IMPORTADA (GEOJSON) ----------------------

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        setImportedGeojson(json);

        if (
          json.features &&
          json.features.length > 0 &&
          json.features[0].properties
        ) {
          const fields = Object.keys(json.features[0].properties);
          setGeojsonFields(fields);
        }

        // Si ya existe una capa importada, la quitamos
        if (map.getSource("imported-geojson")) {
          map.removeLayer("imported-layer");
          map.removeSource("imported-geojson");
        }

        // Añadimos la nueva
        map.addSource("imported-geojson", { type: "geojson", data: json });
        map.addLayer({
          id: "imported-layer",
          type: "fill",
          source: "imported-geojson",
          paint: {
            "fill-color": "#ff0000",
            "fill-opacity": geojsonLayerOpacity,
            "fill-outline-color": "#000000",
          },
        });

        // Ajustamos la vista a su bounding box
        const bounds = new maplibregl.LngLatBounds();
        json.features.forEach((feature) => {
          if (feature.geometry && feature.geometry.type === "Polygon") {
            feature.geometry.coordinates[0].forEach((coord) => {
              bounds.extend(coord);
            });
          } else if (
            feature.geometry &&
            feature.geometry.type === "MultiPolygon"
          ) {
            feature.geometry.coordinates.forEach((polygon) => {
              polygon[0].forEach((coord) => {
                bounds.extend(coord);
              });
            });
          }
        });
        map.fitBounds(bounds, { padding: 50, duration: 1000 });

        setSelectedField("");
        setClickedFeatureInfo(null);
        if (popupRef.current) popupRef.current.remove();
      } catch (error) {
        console.error("Error al leer el archivo:", error);
        alert(
          "Error al procesar el archivo GeoJSON. Verifique que el formato sea correcto."
        );
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
  };

  // ---------------------- CLASIFICACIÓN POR CAMPO ----------------------

  const handleClassify = () => {
    setShowFieldSelector(!showFieldSelector);
    if (showFieldSelector && popupRef.current) {
      popupRef.current.remove();
      setClickedFeatureInfo(null);
    }
  };

  const getRandomColor = () => {
    return (
      "#" +
      Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0")
    );
  };

  const getUniqueValues = (geojson, field) => {
    const values = new Set();
    geojson.features.forEach((feature) => {
      if (feature.properties && feature.properties[field] !== undefined) {
        values.add(feature.properties[field]);
      }
    });
    return Array.from(values);
  };

  const generateColorExpression = (field, uniqueValues) => {
    const newColorMap = {};
    uniqueValues.forEach((value) => {
      newColorMap[value] = getRandomColor();
    });
    setColorMap(newColorMap);

    const expression = ["match", ["get", field]];
    uniqueValues.forEach((value) => {
      expression.push(value, newColorMap[value]);
    });
    expression.push("#ccc"); // Color por defecto
    return expression;
  };

  const applyClassification = (field) => {
    if (!importedGeojson || !map) return;
    setSelectedField(field);
    setShowFieldSelector(false);
    setClickedFeatureInfo(null);

    if (popupRef.current) popupRef.current.remove();

    const uniqueValues = getUniqueValues(importedGeojson, field);
    const expression = generateColorExpression(field, uniqueValues);
    map.setPaintProperty("imported-layer", "fill-color", expression);
  };

  // ---------------------- OPACIDAD Y LEYENDA ----------------------

  const handleOpacityChange = (event) => {
    const opacity = parseFloat(event.target.value);
    setGeojsonLayerOpacity(opacity);
    if (map) {
      map.setPaintProperty("imported-layer", "fill-opacity", opacity);
    }
  };

  const renderLegend = () => {
    if (!selectedField || Object.keys(colorMap).length === 0) return null;
    return (
      <div className="map-legend">
        <h3>Leyenda: {selectedField}</h3>
        <div className="legend-items">
          {Object.entries(colorMap).map(([value, color]) => (
            <div key={value} className="legend-item">
              <span
                className="legend-color"
                style={{ backgroundColor: color }}
              ></span>
              <span className="legend-value">{value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ---------------------- POPUP DE INFORMACIÓN ----------------------

  const createPopupContent = (properties, selectedField) => {
    let popupHTML = '<div class="popup-content">';
    if (selectedField) {
      const value = properties[selectedField];
      const color = getColorForValue(value);
      popupHTML += `
        <h3>Información del elemento</h3>
        <div class="popup-field">
          <strong>Campo de clasificación:</strong> ${selectedField}
        </div>
        <div class="popup-value">
          <strong>Valor:</strong>
          <span class="color-indicator" style="background-color: ${color};"></span>
          ${value !== undefined ? value : "No disponible"}
        </div>
        <hr/>
      `;
    }
    popupHTML += '<div class="popup-properties">';
    Object.entries(properties).forEach(([key, val]) => {
      if (key !== "id" && key !== "lat" && key !== "lng") {
        popupHTML += `
          <div class="popup-property">
            <strong>${key}:</strong> ${
          val !== undefined ? val : "No disponible"
        }
          </div>
        `;
      }
    });
    popupHTML += "</div></div>";
    return popupHTML;
  };

  const getColorForValue = (value) => {
    return colorMap[value] || "#ccc";
  };

  // ---------------------- RENDER ----------------------

  return (
    <div className="map-container">
      {/* BÚSQUEDA */}
      <div className="search-container">
        <input
          type="text"
          placeholder="Buscar municipio..."
          value={searchTerm}
          onChange={handleSearch}
          className="search-input"
        />
        {filteredMunicipios.length > 0 && (
          <ul className="dropdown">
            {filteredMunicipios.map((mun) => (
              <li
                key={mun.properties.MpCodigo}
                onClick={() => selectMunicipio(mun)}
              >
                {mun.properties.MpNombre} - {mun.properties.Depto}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* MAPA */}
      <div id="map"></div>

      {/* BOTONES */}
      <div className="map-buttons">
        {/* Importar archivo */}
        <div className="import-button">
          <input
            type="file"
            id="geojson-input"
            accept=".geojson,.json"
            onChange={handleFileUpload}
            className="hidden-input"
            ref={fileInputRef}
            disabled={isLoading}
          />
          <label
            htmlFor="geojson-input"
            className={`button ${isLoading ? "disabled" : ""}`}
          >
            {isLoading ? "Cargando..." : "Importar GeoJSON"}
          </label>
        </div>

        {/* Clasificar */}
        {importedGeojson && (
          <div className="classify-button-container">
            <button
              onClick={handleClassify}
              className="button classify-button"
              disabled={isLoading}
            >
              Clasificar
            </button>
            {showFieldSelector && (
              <div className="field-selector">
                <h3>Seleccione un campo para clasificar:</h3>
                <ul>
                  {geojsonFields.map((field) => (
                    <li key={field} onClick={() => applyClassification(field)}>
                      {field}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Opacidad de la capa */}
        {importedGeojson && (
          <div className="opacity-slider-container">
            <label htmlFor="opacity-slider">Opacidad de la capa GeoJSON:</label>
            <input
              type="range"
              id="opacity-slider"
              min="0"
              max="1"
              step="0.01"
              value={geojsonLayerOpacity}
              onChange={handleOpacityChange}
              className="opacity-slider"
            />
          </div>
        )}
      </div>

      {/* COORDENADAS DMS (SOLO POSITIVAS) + SELECTORES DE HEMISFERIOS */}
      <div className="coordinate-input-overlay">
        <h3>Ir a coordenadas (DMS):</h3>
        <div>
          <label>
            Latitud:
            <input
              type="number"
              value={latitudeDMS.degrees}
              onChange={handleCoordinateInputChange(
                setLatitudeDMS,
                "degrees",
                0,
                90
              )}
              min="0"
              max="90"
            />
            °
            <input
              type="number"
              value={latitudeDMS.minutes}
              onChange={handleCoordinateInputChange(
                setLatitudeDMS,
                "minutes",
                0,
                59
              )}
              min="0"
              max="59"
            />
            '
            <input
              type="number"
              value={latitudeDMS.seconds}
              onChange={handleCoordinateInputChange(
                setLatitudeDMS,
                "seconds",
                0,
                59
              )}
              min="0"
              max="59"
            />
            "
            <select
              value={latHemisphere}
              onChange={(e) => setLatHemisphere(e.target.value)}
            >
              <option value="N">N</option>
              <option value="S">S</option>
            </select>
          </label>
        </div>

        <div>
          <label>
            Longitud:
            <input
              type="number"
              value={longitudeDMS.degrees}
              onChange={handleCoordinateInputChange(
                setLongitudeDMS,
                "degrees",
                0,
                180
              )}
              min="0"
              max="180"
            />
            °
            <input
              type="number"
              value={longitudeDMS.minutes}
              onChange={handleCoordinateInputChange(
                setLongitudeDMS,
                "minutes",
                0,
                59
              )}
              min="0"
              max="59"
            />
            '
            <input
              type="number"
              value={longitudeDMS.seconds}
              onChange={handleCoordinateInputChange(
                setLongitudeDMS,
                "seconds",
                0,
                59
              )}
              min="0"
              max="59"
            />
            "
            <select
              value={lonHemisphere}
              onChange={(e) => setLonHemisphere(e.target.value)}
            >
              <option value="E">E</option>
              <option value="W">W</option>
            </select>
          </label>
        </div>
        <button onClick={goToCoordinates} disabled={!map}>
          Ir
        </button>
      </div>

      {/* LEYENDA */}
      {selectedField && renderLegend()}

      {/* Info de la feature clickeada (aunque se muestra en popup) */}
      {clickedFeatureInfo && (
        <div className="feature-info-panel">
          {/* El contenido se muestra en el popup del mapa */}
        </div>
      )}
    </div>
  );
};

Mapa.propTypes = {
  setSelectedFeature: PropTypes.func.isRequired,
};

export default Mapa;
