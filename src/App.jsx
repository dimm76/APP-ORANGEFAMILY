import { useEffect, useState } from "react";
import AuthGate from "./app/AuthGate.jsx";
import "./App.css";

function App() {
  const [status, setStatus] = useState({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    const loadHealthStatus = async () => {
      try {
        const response = await fetch("/api/health");

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        setStatus({
          loading: false,
          data,
          error: null,
        });
      } catch (error) {
        setStatus({
          loading: false,
          data: null,
          error: error.message,
        });
      }
    };

    loadHealthStatus();
  }, []);

  return (
    <AuthGate>
      <main>
        <h1>OrangeFamily</h1>

        {status.loading && <p>Comprobando conexión...</p>}

        {status.error && (
          <p>No se pudo conectar con la API: {status.error}</p>
        )}

        {status.data && (
          <pre>{JSON.stringify(status.data, null, 2)}</pre>
        )}
      </main>
    </AuthGate>
  );
}

export default App;
