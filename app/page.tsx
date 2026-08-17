const GAMES = [
  {
    id: "bloque-buster",
    title: "BLOQUE BUSTER",
    short: "Rebota la pelota y destruye muros de neón.",
    cat: "ARCADE",
    cover: "cover-bricks",
    color: "cyan",
    best: 28450,
  },
  {
    id: "caida",
    title: "CAÍDA",
    short: "Encaja las piezas antes de que el techo te aplaste.",
    cat: "PUZZLE",
    cover: "cover-tetro",
    color: "magenta",
    best: 184220,
  },
  {
    id: "serpentina",
    title: "SERPENTINA",
    short: "Crece sin morder tu propia cola.",
    cat: "ARCADE",
    cover: "cover-snake",
    color: "green",
    best: 7820,
  },
  {
    id: "gloton",
    title: "GLOTÓN",
    short: "Devora puntos y escapa de los fantasmas.",
    cat: "ARCADE",
    cover: "cover-glot",
    color: "yellow",
    best: 96400,
  },
  {
    id: "invasores",
    title: "INVASORES",
    short: "Defiende el planeta de filas alienígenas.",
    cat: "SHOOTER",
    cover: "cover-invaders",
    color: "green",
    best: 54190,
  },
  {
    id: "rocas",
    title: "ROCAS",
    short: "Pulveriza asteroides en gravedad cero.",
    cat: "SHOOTER",
    cover: "cover-rocas",
    color: "yellow",
    best: 41200,
  },
  {
    id: "ranaria",
    title: "RANARIA",
    short: "Cruza la autopista de pixeles.",
    cat: "ARCADE",
    cover: "cover-rana",
    color: "green",
    best: 18900,
  },
  {
    id: "duelo-pixel",
    title: "DUELO PIXEL",
    short: "Dos paletas. Una pelota. Reflejos máximos.",
    cat: "VERSUS",
    cover: "cover-duelo",
    color: "cyan",
    best: 24,
  },
];

const CATS = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"];

export default function Home() {
  return (
    <>
      <nav className="av-nav">
        <a className="logo" href="#">
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </a>
        <div className="links">
          <a className="active" href="#">
            Biblioteca
          </a>
          <a href="#">Salón de la Fama</a>
        </div>
        <div className="spacer" />
        <div className="coin-counter">
          <span className="coin" />
          <span>CRÉDITOS · 03</span>
        </div>
        <a className="btn auth-btn" href="#">
          Iniciar Sesión
        </a>
        <button className="btn ghost hamburger" aria-label="Menú">
          ≡
        </button>
      </nav>

      <main className="av-main fade-in">
        <section className="av-hero">
          <h1 className="flicker">ARCADE VAULT</h1>
          <div className="sub">
            INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
          </div>
        </section>

        <div className="av-filters">
          <div className="av-search">
            <span className="ico">⌕</span>
            <input placeholder="Buscar un juego por nombre…" />
          </div>
          <div className="av-chips">
            {CATS.map((c) => (
              <button key={c} className={"chip" + (c === "TODOS" ? " active" : "")}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="av-grid">
          {GAMES.map((g) => (
            <div key={g.id} className="card">
              <div className="cover">
                <div className={"cover-bg " + g.cover} />
                <div className="label">{g.cat}</div>
              </div>
              <div className="meta">
                <div className="title">{g.title}</div>
                <div className="desc">{g.short}</div>
                <div className="row">
                  <div className="score-badge">
                    <span>MEJOR PUNTUACIÓN</span>
                    <b>{g.best.toLocaleString("es-ES")}</b>
                  </div>
                  <button
                    className={
                      "btn " +
                      (g.color === "magenta" ? "magenta" : g.color === "yellow" ? "yellow" : "")
                    }
                  >
                    JUGAR
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--line)",
          padding: "20px 32px",
          textAlign: "center",
          color: "var(--ink-faint)",
          fontFamily: "var(--mono)",
          fontSize: 11,
          letterSpacing: "0.16em",
        }}
      >
        © 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0
      </footer>
    </>
  );
}
