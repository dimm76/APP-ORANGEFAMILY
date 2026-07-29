import { useEffect, useState } from "react";
import { getStorageUsage } from "./storageApi.js";
import "./settings.css";

const CATEGORIES = [
  {
    key: "attachments_bytes",
    label: "Attachments",
    className: "of-storage-category--attachments",
  },
  {
    key: "images_bytes",
    label: "Imágenes",
    className: "of-storage-category--images",
  },
  {
    key: "videos_bytes",
    label: "Vídeos",
    className: "of-storage-category--videos",
  },
];

const numberFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1,
});

function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);

  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const unitIndex = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  const amount = bytes / 1024 ** unitIndex;

  return `${numberFormatter.format(amount)} ${units[unitIndex]}`;
}

function StorageDistribution({ totals }) {
  const totalBytes = Math.max(0, Number(totals.total_bytes) || 0);

  return (
    <>
      <div
        className="of-storage-summary__bar"
        role="img"
        aria-label={`Distribución de ${formatBytes(totalBytes)} de almacenamiento`}
      >
        {totalBytes > 0 ? (
          CATEGORIES.map((category) => {
            const bytes = Math.max(0, Number(totals[category.key]) || 0);

            if (bytes === 0) return null;

            return (
              <span
                key={category.key}
                className={`of-storage-summary__segment ${category.className}`}
                style={{ width: `${(bytes / totalBytes) * 100}%` }}
                title={`${category.label}: ${formatBytes(bytes)}`}
              />
            );
          })
        ) : (
          <span className="of-storage-summary__empty" />
        )}
      </div>

      <div className="of-storage-summary__legend">
        {CATEGORIES.map((category) => {
          const bytes = Math.max(0, Number(totals[category.key]) || 0);

          return (
            <div className="of-storage-summary__legend-item" key={category.key}>
              <span
                className={`of-storage-summary__dot ${category.className}`}
                aria-hidden="true"
              />
              <span>{category.label}</span>
              <strong>{formatBytes(bytes)}</strong>
            </div>
          );
        })}
      </div>
    </>
  );
}

function UserStorageRow({ user }) {
  const totalBytes = Math.max(0, Number(user.total_bytes) || 0);

  return (
    <article className="of-storage-user-row">
      <div className="of-storage-user-row__identity">
        <h3>{user.display_name}</h3>

        {user.role === "owner" ? (
          <span className="of-storage-user-row__role">
            Administrador
          </span>
        ) : null}
      </div>

      <div className="of-storage-user-row__usage">
        <div
          className="of-storage-user-row__bar"
          role="img"
          aria-label={`Distribución de ${formatBytes(
            totalBytes
          )} de almacenamiento para ${user.display_name}`}
        >
          {totalBytes > 0 ? (
            CATEGORIES.map((category) => {
              const bytes = Math.max(
                0,
                Number(user[category.key]) || 0
              );

              if (bytes === 0) return null;

              return (
                <span
                  key={category.key}
                  className={`of-storage-summary__segment ${category.className}`}
                  style={{
                    width: `${(bytes / totalBytes) * 100}%`,
                  }}
                  title={`${category.label}: ${formatBytes(bytes)}`}
                />
              );
            })
          ) : (
            <span className="of-storage-summary__empty" />
          )}
        </div>

        <div className="of-storage-user-row__details">
          <div className="of-storage-user-row__categories">
            {CATEGORIES.map((category) => (
              <span
                className="of-storage-user-row__detail"
                key={category.key}
              >
                <span
                  className={`of-storage-user-row__dot ${category.className}`}
                  aria-hidden="true"
                />
                <span>{category.label}</span>
                <strong>{formatBytes(user[category.key])}</strong>
              </span>
            ))}
          </div>

          <div className="of-storage-user-row__totals">
            <span className="of-storage-user-row__total">
              <span>Total</span>
              <strong>{formatBytes(user.total_bytes)}</strong>
            </span>

            <span className="of-storage-user-row__total">
              <span>Papelera</span>
              <strong>{formatBytes(user.trash_bytes)}</strong>
              <small>
                {user.trash_items}{" "}
                {user.trash_items === 1
                  ? "elemento"
                  : "elementos"}
              </small>
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function StoragePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    getStorageUsage()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudo obtener el uso de almacenamiento."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="od-page">
      <div className="od-page-inner od-page-inner--full od-page-inner--align-stretch">
        <header className="od-page-header">
          <div>
            <h1 className="od-page-title">Almacenamiento</h1>
            <p className="od-page-subtitle">
              Espacio registrado en Wasabi por OrangeFamily.
            </p>
          </div>
        </header>

        {loading ? (
          <p className="od-status-line">Calculando almacenamiento…</p>
        ) : null}

        {error ? (
          <p className="od-status-line od-status-line--error" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error && data ? (
          <>
            <section
              className="of-storage-summary"
              aria-labelledby="of-storage-summary-title"
            >
              <h2
                id="of-storage-summary-title"
                className="of-storage-summary__headline"
              >
                {formatBytes(data.totals.total_bytes)} almacenados
              </h2>

              <p className="of-storage-summary__description">
                Incluye Attachments y todos los archivos físicos registrados de
                OrangePhotos: originales, miniaturas, previews y posters.
              </p>

              <StorageDistribution totals={data.totals} />

              <div className="of-storage-trash">
                <strong>Papelera</strong>
                <span>
                  {formatBytes(data.totals.trash_bytes)} en{" "}
                  {data.totals.trash_items}{" "}
                  {data.totals.trash_items === 1 ? "elemento" : "elementos"}
                </span>
                <small>
                  Este espacio ya está incluido en los totales de imágenes y
                  vídeos.
                </small>
              </div>
            </section>

            {data.integrity.files_without_size > 0 ? (
              <p className="od-status-line" role="status">
                Hay {data.integrity.files_without_size}{" "}
                {data.integrity.files_without_size === 1
                  ? "archivo cuyo tamaño no está registrado"
                  : "archivos cuyo tamaño no está registrado"}
                . Los totales pueden ser inferiores al espacio físico real.
              </p>
            ) : null}

            <section
              className="of-storage-users"
              aria-labelledby="of-storage-users-title"
            >
              <h2 id="of-storage-users-title">Almacenamiento por usuario</h2>

              <div className="of-storage-users__list">
                {data.users.length ? (
                  data.users.map((user) => (
                    <UserStorageRow key={user.user_id} user={user} />
                  ))
                ) : (
                  <div className="od-empty-state">
                    No hay usuarios con almacenamiento registrado.
                  </div>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
