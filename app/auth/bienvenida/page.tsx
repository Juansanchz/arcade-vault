import Link from "next/link";

export default async function BienvenidaPage(
  props: PageProps<"/auth/bienvenida">,
) {
  const searchParams = await props.searchParams;
  const hasError = searchParams.error === "1";

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

        <div className="terminal-success">
          <div className="term-bar">
            <span className="dot r"></span>
            <span className="dot y"></span>
            <span className="dot g"></span>
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body">
            <div className="line">
              <span className="prompt">vault@arcade:~$</span> ./confirm_account
            </div>
            {hasError ? (
              <>
                <div className="line dim">[OK] Verificando token…</div>
                <div className="line fail">
                  [FAIL] El enlace es inválido o expiró.
                </div>
                <div style={{ marginTop: 18 }}>
                  <Link href="/auth" className="btn ghost">
                    VOLVER A INICIAR SESIÓN
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="line dim">[OK] Verificando token…</div>
                <div className="line dim">[OK] Activando cuenta…</div>
                <div className="line success">
                  [OK] CUENTA ACTIVADA
                  <span className="caret">_</span>
                </div>
                <div style={{ marginTop: 18 }}>
                  <Link href="/" className="btn lg">
                    ENTRAR AL VAULT
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
