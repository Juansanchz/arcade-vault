"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";

type Tab = "in" | "up";
type AuthStatus = "idle" | "sending" | "error" | "check-email";

function translateSignInError(message: string): string {
  if (message.toLowerCase().includes("invalid login credentials")) {
    return "Correo o contraseña incorrectos.";
  }
  return "No se pudo iniciar sesión. Intentá de nuevo.";
}

function translateSignUpError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("already registered") ||
    m.includes("user already registered")
  ) {
    return "Ese correo ya está registrado.";
  }
  if (
    m.includes("database error saving new user") ||
    m.includes("duplicate key")
  ) {
    return "Ese nombre de usuario ya está en uso.";
  }
  return "No se pudo crear la cuenta. Intentá de nuevo.";
}

export default function AuthPage() {
  const router = useRouter();
  const { playAsGuest } = useSession();
  const [tab, setTab] = useState<Tab>("in");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const changeTab = (t: Tab) => {
    setTab(t);
    setStatus("idle");
    setErrorMsg("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    const fieldsFilled =
      tab === "in"
        ? email.trim() && pass.trim()
        : username.trim() && email.trim() && pass.trim();

    if (!fieldsFilled || pass.length < 6) {
      setStatus("error");
      setErrorMsg(
        "Completá todos los campos. La contraseña debe tener 6 caracteres o más.",
      );
      return;
    }

    setStatus("sending");
    const supabase = createClient();

    if (tab === "in") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });
      if (error) {
        setStatus("error");
        setErrorMsg(translateSignInError(error.message));
        return;
      }
      router.push("/");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: { username },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(translateSignUpError(error.message));
      return;
    }

    if (
      data.user &&
      data.user.identities &&
      data.user.identities.length === 0
    ) {
      setStatus("error");
      setErrorMsg("Ese correo ya está registrado.");
      return;
    }

    setStatus("check-email");
  };

  const onPlayAsGuest = () => {
    playAsGuest();
    router.push("/");
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={tab === "in" ? "on" : ""}
            onClick={() => changeTab("in")}
          >
            INICIAR SESIÓN
          </button>
          <button
            className={tab === "up" ? "on" : ""}
            onClick={() => changeTab("up")}
          >
            CREAR CUENTA
          </button>
        </div>

        {status === "error" || status === "check-email" ? (
          <div className="terminal-success">
            <div className="term-bar">
              <span className="dot r"></span>
              <span className="dot y"></span>
              <span className="dot g"></span>
              <span className="term-title">VAULT-OS // TERMINAL</span>
            </div>
            <div className="term-body">
              <div className="line">
                <span className="prompt">vault@arcade:~$</span> ./
                {tab === "in" ? "sign_in" : "create_account"}
              </div>
              {status === "check-email" ? (
                <>
                  <div className="line dim">[OK] Cuenta creada…</div>
                  <div className="line dim">
                    [OK] Enviando correo de confirmación…
                  </div>
                  <div className="line success">
                    &gt; Revisá tu correo para activar la cuenta.
                    <span className="caret">_</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="line dim">[OK] Conectando con servidor…</div>
                  <div className="line fail">[FAIL] {errorMsg}</div>
                </>
              )}
              <div style={{ marginTop: 18 }}>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => setStatus("idle")}
                >
                  {status === "check-email" ? "VOLVER" : "REINTENTAR"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            {tab === "up" && (
              <div className="field slide-in">
                <label>Usuario</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="px_kai"
                />
              </div>
            )}
            <div className="field">
              <label>Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@vault.gg"
              />
            </div>
            <div className="field">
              <label>Contraseña</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button
              className="btn lg"
              type="submit"
              style={{ width: "100%", marginTop: 8 }}
              disabled={status === "sending"}
            >
              {status === "sending"
                ? tab === "in"
                  ? "ENTRANDO…"
                  : "CREANDO…"
                : tab === "in"
                  ? "ENTRAR AL VAULT"
                  : "CREAR Y JUGAR"}
            </button>
          </form>
        )}

        <button
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={onPlayAsGuest}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button className="btn ghost" type="button">
            ◆ GOOGLE
          </button>
          <button className="btn ghost" type="button">
            ▣ GITHUB
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
