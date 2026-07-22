import { useState } from "react";
import {
  IonApp,
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonText,
} from "@ionic/react";
import { eyeOffOutline, eyeOutline } from "ionicons/icons";
import { useAuth } from "./authContext.js";
import "./app-login.css";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "No se pudo iniciar sesión."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <IonApp>
      <IonPage className="od-login-page">
        <IonContent
          fullscreen
          scrollY={false}
          className="od-login-page__content"
        >
          <div className="od-login-page__split">
            <div className="od-login-page__form-side">
              <div className="od-login-page__form-stack">
                <div className="od-login-page__card">
                  <h1 className="od-login-page__title">OrangeFamily</h1>
                  <p className="od-login-page__subtitle">
                    Inicia sesión para continuar
                  </p>
                  <form onSubmit={handleSubmit} className="od-login-page__form">
                    <IonList className="od-login-page__list" lines="full">
                      <IonItem className="od-login-page__item">
                        <IonLabel position="stacked">Email</IonLabel>
                        <IonInput
                          type="email"
                          name="email"
                          autoComplete="username"
                          inputMode="email"
                          value={email}
                          required
                          disabled={submitting}
                          onIonInput={(ev) =>
                            setEmail(String(ev.detail.value ?? ""))
                          }
                        />
                      </IonItem>
                      <IonItem className="od-login-page__item od-login-page__item--password">
                        <IonLabel position="stacked">Contraseña</IonLabel>
                        <IonInput
                          type={showPassword ? "text" : "password"}
                          name="password"
                          autoComplete="current-password"
                          value={password}
                          required
                          disabled={submitting}
                          onIonInput={(ev) =>
                            setPassword(String(ev.detail.value ?? ""))
                          }
                        />
                        <IonButton
                          slot="end"
                          fill="clear"
                          type="button"
                          className="od-login-page__toggle-password"
                          aria-label={
                            showPassword
                              ? "Ocultar contraseña"
                              : "Mostrar contraseña"
                          }
                          aria-pressed={showPassword}
                          disabled={submitting}
                          onClick={() => setShowPassword((v) => !v)}
                        >
                          <IonIcon
                            icon={showPassword ? eyeOffOutline : eyeOutline}
                            aria-hidden="true"
                          />
                        </IonButton>
                      </IonItem>
                    </IonList>
                    {error ? (
                      <IonText color="danger" role="alert">
                        <p className="od-login-page__error">{error}</p>
                      </IonText>
                    ) : null}
                    <IonButton
                      type="submit"
                      expand="block"
                      className="od-login-page__submit"
                      disabled={submitting}
                    >
                      {submitting ? "Entrando…" : "Entrar"}
                    </IonButton>
                  </form>
                </div>
              </div>
            </div>
            <div
              className="od-login-page__brand-side"
              aria-hidden="true"
            />
          </div>
        </IonContent>
      </IonPage>
    </IonApp>
  );
}
