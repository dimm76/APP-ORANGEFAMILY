import { useState } from "react";
import { IonApp, IonButton, IonContent, IonInput, IonItem, IonLabel, IonList, IonPage, IonText } from "@ionic/react";
import { postActivate, postResetPassword } from "../shared/api/authApi.js";
import { safeInternalReturnTo } from "./authContext.js";
import "./app-login.css";

export default function AuthActionPage({ mode }) {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";
  const returnTo = safeInternalReturnTo(params.get("returnTo"));
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [error, setError] = useState(""); const [submitting, setSubmitting] = useState(false);
  const activating = mode === "activate";
  async function submit(event) { event.preventDefault(); setError(""); if (password.length < 10) return setError("La contraseña debe tener al menos 10 caracteres."); if (password !== confirm) return setError("Las contraseñas no coinciden."); setSubmitting(true); try { await (activating ? postActivate(token, password) : postResetPassword(token, password)); const next = new URLSearchParams({ auth_message: activating ? "Cuenta activada. Inicia sesión para acceder al álbum compartido." : "Contraseña actualizada. Ya puedes iniciar sesión." }); if (activating && returnTo) next.set("returnTo", returnTo); window.location.assign(`/?${next.toString()}`); } catch (submitError) { setError(submitError.message); } finally { setSubmitting(false); } }
  return <IonApp><IonPage className="od-login-page"><IonContent fullscreen className="od-login-page__content"><div className="od-login-page__split"><div className="od-login-page__form-side"><div className="od-login-page__form-stack"><div className="od-login-page__card"><h1 className="od-login-page__title">{activating ? "Activa tu cuenta" : "Nueva contraseña"}</h1><p className="od-login-page__subtitle">Elige una contraseña de al menos 10 caracteres.</p><form onSubmit={submit}><IonList className="od-login-page__list"><IonItem className="od-login-page__item"><IonLabel position="stacked">Contraseña</IonLabel><IonInput type="password" value={password} onIonInput={event => setPassword(String(event.detail.value || ""))} required /></IonItem><IonItem className="od-login-page__item"><IonLabel position="stacked">Repetir contraseña</IonLabel><IonInput type="password" value={confirm} onIonInput={event => setConfirm(String(event.detail.value || ""))} required /></IonItem></IonList>{error ? <IonText color="danger"><p className="od-login-page__error">{error}</p></IonText> : null}<IonButton type="submit" expand="block" className="od-login-page__submit" disabled={submitting || !token}>{submitting ? "Guardando…" : "Guardar contraseña"}</IonButton>{!token ? <p className="od-login-page__error">El enlace no contiene un token válido.</p> : null}</form></div></div></div><div className="od-login-page__brand-side" aria-hidden="true" /></div></IonContent></IonPage></IonApp>;
}
