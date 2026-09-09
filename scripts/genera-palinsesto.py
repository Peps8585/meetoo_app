#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera le lezioni del palinsesto (tabella `schedules`) dal foglio di Giorgia.

FONTE UNICA, non si ricopia niente a mano:
  ~/Desktop/MEE TOO PILATES/PALINSESTO SETTEMBRE 2026/dati_palinsesto.py
lo stesso file da cui nascono il PDF, l'immagine WhatsApp e la pagina del sito
(che lo legge via meetoo-sito/lib/palinsesto.json).

Produce tre cose dallo STESSO elenco, cosi' l'anteprima non puo' divergere da
quello che finisce nel database:
  _out/anteprima-palinsesto.html   calendario visivo da controllare prima
  _out/lezioni.json                l'elenco in chiaro, per i confronti
  _out/palinsesto.sql              l'INSERT da eseguire

Lo SQL risolve studio e classi PER NOME: nessun identificativo di produzione
finisce nel repo (che e' pubblico).

Uso:
    python3 scripts/genera-palinsesto.py
    # poi si controlla l'anteprima e si esegue _out/palinsesto.sql

Quando Giorgia cambia un orario: si aggiorna il file sorgente e si rilancia.
"""
import importlib.util, json, os, pathlib
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Rome")
OUT = pathlib.Path(__file__).resolve().parent.parent / "_out"
SORGENTE = pathlib.Path(os.path.expanduser(
    "~/Desktop/MEE TOO PILATES/PALINSESTO SETTEMBRE 2026/dati_palinsesto.py"))

STUDIO_SLUG = "meetoo"

# Famiglia del palinsesto -> classe gia' esistente in app (per nome).
# prezzo e durata restano quelli della classe: qui servono solo all'anteprima.
# `posti` e' l'unico dato che non sta nella sorgente: e' la capienza della sala,
# data da Giorgia il 9/9/2026.
FAMIGLIE = {
    "macchine":   dict(classe="Pilates Reformer",   nome_pal="Macchine",
                       prezzo=23, durata=50, posti=4),
    "matwork":    dict(classe="Pilates Matwork",    nome_pal="Matwork",
                       prezzo=16, durata=50, posti=7),
    "yoga":       dict(classe="Yoga",               nome_pal="Yoga",
                       prezzo=18, durata=50, posti=7),
    "funzionale": dict(classe="Pilates Funzionale", nome_pal="Funzionale",
                       prezzo=16, durata=50, posti=7),
}

# Il circuito del giovedi' gira a macchine ma con piu' postazioni della sala reformer.
POSTI_ECCEZIONI = {"circuito": 7}

# Restano fuori dalla generazione: laboratorio e workshop (date ancora da fissare
# con Carolina) e il funzionale del sabato, che e' mensile e non settimanale.
FAMIGLIE_ESCLUSE = {"somatica", "evento"}
SOTTO_ESCLUSI = {"una volta al mese"}

PRIMO_GIORNO = date(2026, 9, 10)
ULTIMO_GIORNO = date(2026, 12, 19)

# Giorni di chiusura: niente lezioni. Ognissanti cade di domenica, non serve.
CHIUSURE = {date(2026, 12, 8): "Immacolata"}

GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"]
ISO = {g: i + 1 for i, g in enumerate(GIORNI)}


def carica_sorgente():
    spec = importlib.util.spec_from_file_location("dati_palinsesto", SORGENTE)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def voci_ricorrenti(mod):
    """Voci che diventano lezioni settimanali, piu' l'elenco degli scarti."""
    tenute, scartate = [], []
    for (ora, giorno), (fam, nome, sotto, nota) in mod.LEZIONI.items():
        motivo = None
        if fam in FAMIGLIE_ESCLUSE:
            motivo = "evento a data da definire"
        elif sotto in SOTTO_ESCLUSI:
            motivo = "frequenza mensile, non settimanale"
        elif nota:
            motivo = nota
        (scartate if motivo else tenute).append(
            dict(ora=ora, giorno=giorno, famiglia=fam, nome=nome,
                 sotto=sotto, motivo=motivo))
    return tenute, scartate


def note_lezione(v, cfg):
    """Livello e varianti vanno nelle note, non in una classe nuova."""
    parti = []
    if v["nome"] != cfg["nome_pal"]:
        parti.append(v["nome"])       # es. Ayuryoga sotto la classe Yoga
    if v["sotto"]:
        parti.append(v["sotto"])      # es. livello base, intermedio, circuito
    return " · ".join(parti) or None


def posti_di(v, cfg):
    return POSTI_ECCEZIONI.get(v["sotto"], cfg["posti"])


def genera(mod):
    tenute, scartate = voci_ricorrenti(mod)
    righe, saltate = [], []
    giorno = PRIMO_GIORNO
    while giorno <= ULTIMO_GIORNO:
        nome_giorno = GIORNI[giorno.weekday()]
        for v in tenute:
            if v["giorno"] != nome_giorno:
                continue
            if giorno in CHIUSURE:
                saltate.append({**v, "data": giorno.isoformat(), "motivo": CHIUSURE[giorno]})
                continue
            cfg = FAMIGLIE[v["famiglia"]]
            h, m = v["ora"].split(".")
            inizio = datetime(giorno.year, giorno.month, giorno.day, int(h), int(m), tzinfo=TZ)
            righe.append(dict(
                classe=cfg["classe"],
                starts_at=inizio.isoformat(),
                ends_at=(inizio + timedelta(minutes=cfg["durata"])).isoformat(),
                max_spots=posti_di(v, cfg),
                notes=note_lezione(v, cfg),
                _famiglia=v["famiglia"], _data=giorno.isoformat(),
                _ora=v["ora"], _giorno=nome_giorno,
            ))
        giorno += timedelta(days=1)
    righe.sort(key=lambda r: r["starts_at"])
    return righe, tenute, scartate, saltate


def scrivi_sql(tenute, dest):
    """INSERT che risolve studio e classi per nome: nessun id nel repo."""
    vals = []
    for v in sorted(tenute, key=lambda x: (ISO[x["giorno"]], float(x["ora"]))):
        cfg = FAMIGLIE[v["famiglia"]]
        nota = note_lezione(v, cfg)
        nota = "null" if nota is None else "'" + nota.replace("'", "''") + "'"
        h, m = v["ora"].split(".")
        vals.append(f"  ({ISO[v['giorno']]},'{int(h):02d}:{m}','{cfg['classe']}',"
                    f"{posti_di(v, cfg)},{nota})")
    chiusure = ", ".join(f"'{d.isoformat()}'::date" for d in sorted(CHIUSURE))
    corpo_vals = ",\n".join(vals)
    dest.write_text(f"""-- Palinsesto Mee Too, generato da scripts/genera-palinsesto.py
-- Non modificare a mano: si cambia dati_palinsesto.py e si rilancia lo script.
-- Periodo {PRIMO_GIORNO} -> {ULTIMO_GIORNO}. Orari in Europe/Rome: il cast
-- `at time zone` regge da solo il rientro dell'ora solare del 25 ottobre.
with pattern(dow, ora, classe, posti, note) as (values
{corpo_vals}
),
studio as (select id from public.studios where slug = '{STUDIO_SLUG}'),
giorni as (
  select d::date as g
  from generate_series('{PRIMO_GIORNO}'::date, '{ULTIMO_GIORNO}'::date, '1 day') d
  where extract(isodow from d) between 1 and 6
    and d::date not in ({chiusure})
)
insert into public.schedules
  (studio_id, class_id, starts_at, ends_at, max_spots, current_bookings, is_cancelled, notes)
select
  (select id from studio), c.id,
  (g.g + p.ora::time) at time zone 'Europe/Rome',
  ((g.g + p.ora::time) at time zone 'Europe/Rome') + interval '50 minutes',
  p.posti, 0, false, p.note
from giorni g
join pattern p on p.dow = extract(isodow from g.g)
join public.classes c
  on c.name = p.classe and c.studio_id = (select id from studio);
""", encoding="utf-8")


COLORI = {"macchine": ("#EFE1CE", "#7A5A3D", "#A8876A"),
          "matwork": ("#DFE8DA", "#4E5E49", "#7D8B78"),
          "yoga": ("#F0DBD8", "#8A4F40", "#B4776B"),
          "funzionale": ("#DCE3E7", "#4E5B66", "#7C8B96")}


def anteprima(righe, tenute, scartate, saltate, dest):
    per_classe = {}
    for r in righe:
        per_classe[r["classe"]] = per_classe.get(r["classe"], 0) + 1
    lun = PRIMO_GIORNO + timedelta(days=(7 - PRIMO_GIORNO.weekday()) % 7)
    campione = [r for r in righe
                if lun.isoformat() <= r["_data"] <= (lun + timedelta(days=5)).isoformat()]
    ore = sorted({r["_ora"] for r in campione}, key=float)
    griglia = {(r["_ora"], r["_giorno"]): r for r in campione}

    def cella(ora, g):
        r = griglia.get((ora, g))
        if not r:
            return '<td class="vuota"></td>'
        bg, ink, bar = COLORI[r["_famiglia"]]
        nota = f'<span class="nota">{r["notes"]}</span>' if r["notes"] else ""
        return (f'<td class="lez" style="background:{bg};color:{ink};border-left:3px solid {bar}">'
                f'<b>{r["classe"].replace("Pilates ", "")}</b>{nota}'
                f'<span class="posti">{r["max_spots"]} posti · '
                f'{FAMIGLIE[r["_famiglia"]]["prezzo"]}€</span></td>')

    corpo = "".join(f'<tr><th class="ora">{o.replace(".", ":")}</th>'
                    + "".join(cella(o, g) for g in GIORNI[:6]) + "</tr>" for o in ore)
    scart = "".join(f'<li><b>{s["giorno"]} {s["ora"].replace(".", ":")}</b> — {s["nome"]}'
                    + (f' ({s["sotto"]})' if s["sotto"] else "")
                    + f' <span class="perche">{s["motivo"]}</span></li>' for s in scartate)
    salt = "".join(f'<li>{s["data"]} — {s["giorno"]} {s["ora"].replace(".", ":")} '
                   f'{s["nome"]} <span class="perche">{s["motivo"]}</span></li>'
                   for s in saltate) or "<li>nessuna</li>"
    classi = "".join(f'<tr><td>{k}</td><td class="num">{v}</td></tr>'
                     for k, v in sorted(per_classe.items()))

    dest.write_text(f"""<!doctype html><html lang="it"><head><meta charset="utf-8">
<title>Anteprima palinsesto app</title><style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;background:#ded6c8;color:#2c2c2c;padding:28px 20px 60px}}
.wrap{{max-width:1100px;margin:0 auto}}
h1{{font-size:20px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;margin-bottom:4px}}
.sub{{font-size:13px;color:#6b6357;margin-bottom:22px}}
.kpi{{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px}}
.k{{background:#f5f0e8;border:1px solid #fff;border-radius:14px;padding:12px 18px;min-width:130px}}
.k b{{display:block;font-size:26px;font-weight:800;line-height:1}}
.k span{{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#7a7266}}
h2{{font-size:13px;text-transform:uppercase;letter-spacing:.14em;color:#6b6357;margin:26px 0 10px}}
table{{width:100%;border-collapse:separate;border-spacing:4px;background:#f5f0e8;border-radius:14px;padding:10px}}
th.g{{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#7a7266;padding:6px 0}}
th.ora{{font-size:11px;font-weight:600;color:#7a7266;width:52px;text-align:right;padding-right:8px}}
td.vuota{{background:#efe9df;border-radius:8px;height:44px}}
td.lez{{border-radius:8px;padding:6px 8px;vertical-align:top;line-height:1.25}}
td.lez b{{font-size:11.5px;font-weight:700;display:block}}
.nota{{display:block;font-size:9.5px;opacity:.8}}
.posti{{display:block;font-size:9px;opacity:.65;margin-top:2px}}
ul{{background:#f5f0e8;border-radius:14px;padding:14px 18px 14px 34px}}
li{{font-size:12.5px;margin:5px 0}}
.perche{{color:#8a7f70;font-size:11px}}
.tab2{{background:#f5f0e8;border-radius:14px;border-spacing:0;padding:6px}}
.tab2 td{{padding:7px 12px;font-size:12.5px;border-bottom:1px solid #e6ded1}}
.tab2 td.num{{text-align:right;font-weight:700;width:70px}}
</style></head><body><div class="wrap">
<h1>Palinsesto Mee Too — anteprima di cosa entra nell'app</h1>
<p class="sub">Generato da <code>dati_palinsesto.py</code>, la stessa fonte del PDF e del sito.
Dal {PRIMO_GIORNO.strftime('%d/%m/%Y')} al {ULTIMO_GIORNO.strftime('%d/%m/%Y')}.</p>
<div class="kpi">
  <div class="k"><b>{len(righe)}</b><span>lezioni</span></div>
  <div class="k"><b>{len(tenute)}</b><span>a settimana</span></div>
  <div class="k"><b>{len({r['_data'] for r in righe})}</b><span>giorni</span></div>
  <div class="k"><b>{len(scartate)}</b><span>voci escluse</span></div>
</div>
<h2>Settimana tipo (quella del {lun.strftime('%d/%m')})</h2>
<table><tr><th class="ora"></th>{"".join(f'<th class="g">{g}</th>' for g in GIORNI[:6])}</tr>{corpo}</table>
<h2>Lezioni per disciplina</h2><table class="tab2">{classi}</table>
<h2>Voci del palinsesto non inserite</h2><ul>{scart}</ul>
<h2>Giorni di chiusura saltati</h2><ul>{salt}</ul>
</div></body></html>""", encoding="utf-8")


def main():
    OUT.mkdir(exist_ok=True)
    mod = carica_sorgente()
    righe, tenute, scartate, saltate = genera(mod)
    pulite = [{k: v for k, v in r.items() if not k.startswith("_")} for r in righe]
    (OUT / "lezioni.json").write_text(json.dumps(pulite, ensure_ascii=False, indent=1), encoding="utf-8")
    scrivi_sql(tenute, OUT / "palinsesto.sql")
    anteprima(righe, tenute, scartate, saltate, OUT / "anteprima-palinsesto.html")
    print(f"voci settimanali : {len(tenute)}")
    print(f"voci escluse     : {len(scartate)}")
    print(f"lezioni generate : {len(righe)}")
    print(f"saltate chiusura : {len(saltate)}")
    print(f"periodo          : {righe[0]['starts_at'][:10]} -> {righe[-1]['starts_at'][:10]}")
    print(f"output in        : {OUT}")


if __name__ == "__main__":
    main()
