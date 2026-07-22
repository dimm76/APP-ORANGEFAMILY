import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { IonApp, IonContent, IonPage, IonSpinner } from "@ionic/react";
import { fetchAuthMe, postAuthLogin, postAuthLogout } from "../shared/api/authApi.js";
import { AuthContext } from "./authContext.js";
import LoginPage from "./LoginPage.jsx";
import "./app-login.css";

export default function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { user: next } = await fetchAuthMe();
      if (!cancelled) {
        setUser(next);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshMe = useCallback(async () => {
    const { user: next } = await fetchAuthMe();
    setUser(next);
    return next;
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await postAuthLogin(email, password);
    if (data && data.ok === true && data.user && typeof data.user === "object") {
      setUser(data.user);
      return data.user;
    }
    throw new Error("Login inválido");
  }, []);

  const logout = useCallback(async () => {
    try {
      await postAuthLogout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, login, logout, refreshMe }),
    [user, login, logout, refreshMe]
  );

  if (!ready) {
    return (
      <IonApp>
        <IonPage>
          <IonContent className="ion-padding od-login-loading">
            <div className="od-login-loading-inner">
              <IonSpinner name="crescent" />
            </div>
          </IonContent>
        </IonPage>
      </IonApp>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {!user ? <LoginPage /> : children}
    </AuthContext.Provider>
  );
}
