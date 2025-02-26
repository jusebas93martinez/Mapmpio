import PropTypes from "prop-types";

const Dashboard = ({ feature }) => {
  return (
    <div className="dashboard">
      {feature ? (
        <div className="dashboard-content">
          <h2>{feature.MpNombre}</h2>
          <p>
            <strong>Departamento:</strong> {feature.Depto}
          </p>
          <p>
            <strong>Código:</strong> {feature.MpCodigo}
          </p>
          <p>
            <strong>Área:</strong> {feature.MpArea.toFixed(2)} km²
          </p>
          <p>
            <strong>Altitud:</strong> {feature.MpAltitud} m
          </p>
        </div>
      ) : (
        <p className="placeholder-text">Seleccione un municipio</p>
      )}
    </div>
  );
};

Dashboard.propTypes = {
  feature: PropTypes.object,
};

export default Dashboard;
