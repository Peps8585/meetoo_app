"""Email di accesso di Supabase (Auth) in italiano, con la grafica Mee Too.

Supabase manda da solo le email di conferma registrazione, nuova password, ecc.
Di serie sono in inglese. Questo script scrive i modelli in italiano in
supabase/templates/auth/ (uno per tipo, da incollare in Supabase: Authentication
-> Emails -> Templates) e, se gli si passa un percorso, un'anteprima HTML con
tutte le email una sotto l'altra.

Stessa grafica di lib/email/templates.ts: fondo crema, logo PNG, scheda bianca,
pulsante scuro. Le parti tra doppie graffe ({{ .ConfirmationURL }}, ...) le
riempie Supabase al momento dell'invio.

Uso: python3 scripts/genera-email-auth.py [anteprima.html]
"""
import html, os, sys

QUI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(QUI, "..", "supabase", "templates", "auth")

BG, INK, ACCENT, SAGE = "#f5f0e8", "#2c2c2c", "#a8876a", "#7d8b78"
FONT = "font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;"
LOGO = "https://regali.meetoopilates.com/brand/email-logo.png"


def pulsante(href, testo):
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
      <tr><td style="background-color:{INK}; border-radius:999px;">
        <a href="{href}" style="{FONT} display:inline-block; padding:14px 36px; font-size:13px; letter-spacing:0.18em; text-transform:uppercase; color:{BG}; text-decoration:none;">{testo}</a>
      </td></tr>
    </table>"""


def paragrafo(testo, piccolo=False):
    if piccolo:
        return f'<p style="{FONT} margin:24px 0 0; font-size:13px; line-height:1.7; color:{SAGE};">{testo}</p>'
    return f'<p style="{FONT} margin:0 0 16px; font-size:15px; line-height:1.7; color:{INK};">{testo}</p>'


def titolo(testo):
    return f'<h1 style="{FONT} margin:0 0 20px; font-size:18px; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:{INK}; text-align:center;">{testo}</h1>'


def layout(corpo):
    return f"""<!doctype html>
<html lang="it">
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; background-color:{BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{BG};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <img src="{LOGO}" width="150" alt="MEE TOO" style="{FONT} display:block; width:150px; height:auto; border:0; font-size:24px; font-weight:800; letter-spacing:0.3em; color:{INK};">
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff; border-radius:16px; padding:36px 32px;">
              {corpo}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:28px;">
              <div style="{FONT} font-size:11px; letter-spacing:0.12em; color:{SAGE};">MEE TOO PILATES &middot; PIEVE DI CURTAROLO</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


# (file, nome in Supabase, oggetto, corpo)
EMAIL = [
    (
        "conferma-registrazione.html", "Confirm signup", "Conferma il tuo account Mee Too",
        titolo("Ci sei quasi")
        + paragrafo("Ciao,")
        + paragrafo("manca solo un passaggio: conferma la tua email e il tuo account Mee Too è pronto. Da lì prenoti le lezioni e vedi quante te ne restano.")
        + pulsante("{{ .ConfirmationURL }}", "Conferma l'email")
        + paragrafo("Se non hai chiesto tu di registrarti, ignora questa email: senza conferma l'account non si attiva.", piccolo=True),
    ),
    (
        "invito.html", "Invite user", "Il tuo account Mee Too è pronto",
        titolo("Ti aspettiamo")
        + paragrafo("Ciao,")
        + paragrafo("lo studio Mee Too Pilates ti ha creato un account. Scegli la tua password e sei dentro.")
        + pulsante("{{ .ConfirmationURL }}", "Attiva l'account")
        + paragrafo("Se pensi che sia un errore, scrivici su WhatsApp al 389 295 2958.", piccolo=True),
    ),
    (
        "accesso-con-link.html", "Magic link", "Il tuo link per entrare in Mee Too",
        titolo("Entra in Mee Too")
        + paragrafo("Ciao,")
        + paragrafo("ecco il link per entrare nel tuo account senza password. Funziona una volta sola e scade dopo poco.")
        + pulsante("{{ .ConfirmationURL }}", "Entra")
        + paragrafo("Se non l'hai chiesto tu, ignora questa email: nessuno può entrare senza questo link.", piccolo=True),
    ),
    (
        "cambio-email.html", "Change email address", "Conferma il nuovo indirizzo email",
        titolo("Nuovo indirizzo email")
        + paragrafo("Ciao,")
        + paragrafo("hai chiesto di usare <strong>{{ .NewEmail }}</strong> per il tuo account Mee Too al posto di {{ .Email }}. Conferma dal pulsante e il cambio è fatto.")
        + pulsante("{{ .ConfirmationURL }}", "Conferma il cambio")
        + paragrafo("Se non l'hai chiesto tu, ignora questa email: l'indirizzo resta quello di prima.", piccolo=True),
    ),
    (
        "nuova-password.html", "Reset password", "Scegli una nuova password",
        titolo("Nuova password")
        + paragrafo("Ciao,")
        + paragrafo("hai chiesto di cambiare la password del tuo account Mee Too. Il link funziona una volta sola e scade dopo poco.")
        + pulsante("{{ .ConfirmationURL }}", "Scegli la password")
        + paragrafo("Se non l'hai chiesto tu, ignora questa email: la tua password resta quella di prima.", piccolo=True),
    ),
    (
        "codice-verifica.html", "Reauthentication", "Il tuo codice di verifica",
        titolo("Codice di verifica")
        + paragrafo("Ciao,")
        + paragrafo("per confermare l'operazione che stai facendo nel tuo account Mee Too usa questo codice:")
        + f'<p style="{FONT} margin:24px 0 0; font-size:28px; font-weight:700; letter-spacing:0.3em; color:{INK}; text-align:center;">{{{{ .Token }}}}</p>'
        + paragrafo("Se non stai facendo niente nel tuo account, ignora questa email.", piccolo=True),
    ),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    indice = ["# Email di accesso (Supabase Auth) in italiano", "",
              "Generate da `scripts/genera-email-auth.py`, non modificare a mano.",
              "Su Supabase: Authentication -> Emails -> Templates. Per ognuna: oggetto nel campo Subject,",
              "contenuto del file nel campo del messaggio (vista sorgente/HTML).", ""]
    for nome, supabase, oggetto, corpo in EMAIL:
        with open(os.path.join(OUT, nome), "w", encoding="utf-8") as f:
            f.write(layout(corpo))
        indice.append(f"- **{supabase}**: oggetto `{oggetto}`, file `{nome}`")
    with open(os.path.join(OUT, "README.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(indice) + "\n")

    if len(sys.argv) > 1:
        esempi = {"{{ .ConfirmationURL }}": "#", "{{ .Email }}": "marta@esempio.it",
                  "{{ .NewEmail }}": "marta.nuova@esempio.it", "{{ .Token }}": "482913"}
        blocchi = []
        for nome, supabase, oggetto, corpo in EMAIL:
            pagina = layout(corpo)
            for k, v in esempi.items():
                pagina = pagina.replace(k, v)
            blocchi.append(
                f'<section><p class="cosa">{html.escape(supabase)} &middot; oggetto: <b>{html.escape(oggetto)}</b></p>'
                f'<iframe srcdoc="{html.escape(pagina)}"></iframe></section>')
        with open(sys.argv[1], "w", encoding="utf-8") as f:
            f.write("""<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Email di accesso Mee Too</title>
<style>body{margin:0;background:#e6dccd;font-family:-apple-system,Helvetica,sans-serif;padding:32px 16px}
h1{font-size:15px;letter-spacing:.14em;text-transform:uppercase;color:#a8876a;text-align:center;margin:0 0 6px}
p.sotto{text-align:center;color:#6f6a63;font-size:14px;margin:0 0 28px}
.griglia{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:24px;max-width:1400px;margin:0 auto}
section{background:#fff;border-radius:14px;padding:12px;box-shadow:0 8px 24px rgb(44 44 44/.1)}
p.cosa{font-size:13px;color:#2c2c2c;margin:4px 6px 10px}iframe{width:100%;height:660px;border:0;border-radius:8px}</style></head>
<body><h1>Email di accesso Mee Too</h1><p class="sotto">Come arriveranno a chi si registra, cambia password o entra con un link.</p>
<div class="griglia">""" + "".join(blocchi) + "</div></body></html>")


main()
