# Email di accesso (Supabase Auth) in italiano

Generate da `scripts/genera-email-auth.py`, non modificare a mano.
Su Supabase: Authentication -> Emails -> Templates. Per ognuna: oggetto nel campo Subject,
contenuto del file nel campo del messaggio (vista sorgente/HTML).

- **Confirm signup**: oggetto `Conferma il tuo account Mee Too`, file `conferma-registrazione.html`
- **Invite user**: oggetto `Il tuo account Mee Too è pronto`, file `invito.html`
- **Magic link**: oggetto `Il tuo link per entrare in Mee Too`, file `accesso-con-link.html`
- **Change email address**: oggetto `Conferma il nuovo indirizzo email`, file `cambio-email.html`
- **Reset password**: oggetto `Scegli una nuova password`, file `nuova-password.html`
- **Reauthentication**: oggetto `Il tuo codice di verifica`, file `codice-verifica.html`
