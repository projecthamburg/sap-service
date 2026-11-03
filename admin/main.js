import {
  prepareMapsApp,
  installMapsApp,
  launchMapsApp,
  isMapsApp,
} from "../src/pwa.js";
import * as auth from "./auth.js";
import { escapeHTML as esc } from "../src/utils.js";
import { mountInbox } from "../src/inbox.js";
import { mountMaps } from "./maps.js";
import "./portal.css";
export async function mountAdmin(root, language, config, all) {
  const fr = language === "fr",
    w = (en, frText) => (fr ? frText : en);
  let disposed = false,
    disposeTool = () => {},
    generation = 0;
  root.classList.add("admin-portal");
  const headerParts = [
    document.querySelector(".site-header"),
    document.querySelector(".utility-bar"),
  ].filter(Boolean);
  const syncHeaderHeight = () =>
    root.style.setProperty(
      "--admin-header-height",
      `${headerParts.reduce((height, element) => height + element.getBoundingClientRect().height, 0)}px`
    );
  const headerObserver = new ResizeObserver(syncHeaderHeight);
  headerParts.forEach((element) => headerObserver.observe(element));
  syncHeaderHeight();
  prepareMapsApp();
  root.innerHTML = `<section class="admin-shell"><p class="eyebrow">SAP SERVICE INC. / ${w("OPERATIONS", "OPÉRATIONS")}</p><h1>${w("Your workspace.", "Votre espace de travail.")}</h1><div id="admin-body" role="region" aria-label="Admin"><p role="status">${w("Connecting securely…", "Connexion sécurisée…")}</p></div></section>`;
  const body = root.querySelector("#admin-body");
  const connectionError = (e) =>
    !navigator.onLine ||
    ["TypeError", "TimeoutError", "NetworkError"].includes(e.name) ||
    e.status >= 500 ||
    /failed to fetch|network request failed|network error|load failed/i.test(
      e.message || ""
    );
  function reconnect(retry) {
    if (disposed) return;
    body.innerHTML = `<div class="admin-login"><h1>${w("Connect to continue", "Connexion requise")}</h1><p>${w("Sign-in and private site data require an internet connection. Check your connection, then retry.", "La connexion et les sites privés nécessitent Internet. Vérifiez votre connexion, puis réessayez.")}</p><button class="button primary" data-retry-offline>${w("Retry", "Réessayer")}</button></div>`;
    body.querySelector("[data-retry-offline]").onclick = (e) => {
      e.currentTarget.disabled = true;
      retry();
    };
  }
  async function request(path, options = {}) {
    let bearer;
    try {
      bearer = await auth.token();
    } catch (e) {
      if (connectionError(e)) throw e;
      disposeTool();
      disposeTool = () => {};
      auth.signOut();
      login(e.message);
      throw e;
    }
    const r = await fetch(config.apiUrl + path, {
      ...options,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${bearer}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      signal: AbortSignal.timeout(30000),
    });
    let data;
    try {
      data = await r.json();
    } catch {
      throw Error(
        w(
          "The service did not respond. Please retry.",
          "Le service ne répond pas. Réessayez."
        )
      );
    }
    if (r.status === 401) {
      auth.signOut();
      disposeTool();
      disposeTool = () => {};
      login();
      throw Error(w("Please sign in again.", "Veuillez vous reconnecter."));
    }
    if (!r.ok)
      throw Object.assign(Error(data.error || "Request failed."), {
        data,
        status: r.status,
      });
    return data;
  }
  function login(message = "") {
    if (disposed) return;
    body.innerHTML = `<form class="admin-login"><h1>${w("Admin sign-in", "Connexion administrateur")}</h1><p>${w("Invited team members only.", "Réservé aux membres invités.")}</p><label class="field"><span>${w("Email", "Courriel")}</span><input name="email" type="email" autocomplete="username" required></label><label class="field"><span>${w("Password", "Mot de passe")}</span><input name="password" type="password" autocomplete="current-password" required></label><p role="status" class="admin-status">${esc(message)}</p><button type="submit" class="button primary">${w("Sign in", "Se connecter")}</button><button type="button" class="text-link" data-forgot>${w("Forgot password?", "Mot de passe oublié?")}</button></form>`;
    const form = body.querySelector("form");
    form.onsubmit = async (e) => {
      e.preventDefault();
      await busy(form, async () => {
        const d = new FormData(form),
          r = await auth.signIn(d.get("email").trim(), d.get("password"));
        form.reset();
        r.challenge ? challenge(r.challenge) : workspace();
      });
    };
    form.querySelector("[data-forgot]").onclick = () => recover();
  }
  async function busy(form, fn) {
    const b = form.querySelector("[type=submit]");
    b.disabled = true;
    const status = form.querySelector("[role=status]");
    status.textContent = w("Please wait…", "Veuillez patienter…");
    try {
      await fn();
    } catch (e) {
      status.textContent = connectionError(e)
        ? w(
            "Connection unavailable. Check your connection and try again.",
            "Connexion indisponible. Vérifiez votre connexion et réessayez."
          )
        : e.message || "Sign-in failed.";
    } finally {
      b.disabled = false;
    }
  }
  function challenge(kind) {
    body.innerHTML = `<form class="admin-login"><h1>${kind === "password" ? w("Choose your password", "Choisissez votre mot de passe") : w("Verification code", "Code de vérification")}</h1><p>${kind === "password" ? w("Use at least 14 characters, including upper and lower case, a number and a symbol.", "Utilisez au moins 14 caractères, des majuscules, minuscules, un chiffre et un symbole.") : w("Enter the code from your authentication method.", "Entrez le code de votre méthode d’authentification.")}</p><label class="field"><span>${kind === "password" ? w("New password", "Nouveau mot de passe") : w("Code", "Code")}</span><input name="value" type="${kind === "password" ? "password" : "text"}" autocomplete="${kind === "password" ? "new-password" : "one-time-code"}" required ${kind === "password" ? 'minlength="14"' : 'inputmode="numeric"'}></label><p role="status"></p><button type="submit" class="button primary">${w("Continue", "Continuer")}</button></form>`;
    const f = body.querySelector("form");
    f.onsubmit = (e) => {
      e.preventDefault();
      busy(f, async () => {
        const r = await auth.answer(new FormData(f).get("value"));
        f.reset();
        r.challenge ? challenge(r.challenge) : workspace();
      });
    };
  }
  function recover() {
    body.innerHTML = `<form class="admin-login"><h1>${w("Reset password", "Réinitialiser le mot de passe")}</h1><label class="field"><span>${w("Account email", "Courriel du compte")}</span><input name="email" type="email" autocomplete="username" required></label><p role="status"></p><button class="button primary" type="submit">${w("Send code", "Envoyer le code")}</button><button type="button" class="text-link" data-back>${w("Back to sign-in", "Retour à la connexion")}</button></form>`;
    let step = 0;
    const f = body.querySelector("form");
    f.querySelector("[data-back]").onclick = () => login();
    f.onsubmit = (e) => {
      e.preventDefault();
      busy(f, async () => {
        const d = new FormData(f);
        if (!step) {
          await auth.forgot(d.get("email"));
          step = 1;
          f.querySelector("label").hidden = true;
          f.insertAdjacentHTML(
            "afterbegin",
            `<p>${w("If the account can be recovered, a code has been sent.", "Si le compte peut être récupéré, un code a été envoyé.")}</p><label class="field"><span>Code</span><input name="code" autocomplete="one-time-code" required></label><label class="field"><span>${w("New password (14+ characters)", "Nouveau mot de passe (14 caractères minimum)")}</span><input name="password" type="password" autocomplete="new-password" minlength="14" required></label>`
          );
        } else {
          await auth.reset(d.get("code"), d.get("password"));
          login(
            w(
              "Password updated. Please sign in.",
              "Mot de passe modifié. Connectez-vous."
            )
          );
        }
      });
    };
  }
  async function workspace() {
    if (disposed) return;
    const g = ++generation;
    disposeTool();
    try {
      const session = await request("/admin/session");
      if (disposed || g !== generation) return;
      body.innerHTML = `<div class="admin-toolbar"><nav aria-label="${w("Admin tools", "Outils administrateur")}"><button class="button secondary" data-tool="maps">${w("Maps", "Cartes")}</button><button class="button secondary" data-tool="inbox">${w("Inbox", "Demandes et candidatures")}</button></nav><div class="admin-account"><span>${esc(auth.accountLabel() || session.user)}</span><button class="text-link" data-open-app>${w("Open Maps app", "Ouvrir l’app Cartes")}</button><button class="text-link" data-install-app>${w("Install Maps app", "Installer l’app Cartes")}</button><button class="text-link" data-map-fullscreen hidden></button><button class="text-link" data-logout>${w("Sign out", "Se déconnecter")}</button></div></div><div id="admin-tool"></div>`;
      body.querySelector("[data-open-app]").onclick = () =>
        launchMapsApp(language);
      body.querySelector("[data-install-app]").onclick = async () => {
        if (!(await installMapsApp())) {
          const d = document.createElement("dialog");
          d.className = "admin-dialog";
          d.innerHTML = `<header><h3>${w("Install SAP Maps", "Installer SAP Cartes")}</h3><button class="icon-button" aria-label="Close">×</button></header><div class="dialog-content"><p>${w("On iPhone/iPad: open in Safari, tap Share → Add to Home Screen, enable Open as Web App if shown, then Add. On Android/desktop Chrome: use Install app or Add to Home screen from the browser menu.", "Sur iPhone/iPad : ouvrez dans Safari, touchez Partager → Sur l’écran d’accueil, activez « Ouvrir comme app web » si proposé, puis Ajouter. Sur Android ou Chrome ordinateur : choisissez Installer l’application dans le menu du navigateur.")}</p><p>${w("Open the Maps app and allow location access to use your position and nearby alerts. Keep the app open for reliable live location updates.", "Ouvrez l’app Cartes et autorisez la localisation pour les alertes de proximité. Gardez l’app ouverte pour des mises à jour fiables.")}</p></div>`;
          root.append(d);
          d.querySelector("button").onclick = () => d.close();
          d.addEventListener("close", () => d.remove());
          d.showModal();
        }
      };
      body.querySelector("[data-logout]").onclick = () => {
        generation++;
        disposeTool();
        disposeTool = () => {};
        auth.signOut();
        login();
      };
      window.scrollTo(0, 0);
      const tool = body.querySelector("#admin-tool");
      async function show(name) {
        disposeTool();
        disposeTool = () => {};
        body
          .querySelectorAll("[data-tool]")
          .forEach((b) =>
            b.setAttribute("aria-pressed", String(b.dataset.tool === name))
          );
        tool.innerHTML = "";
        if (name === "maps")
          disposeTool = await mountMaps(tool, { request, language });
        else
          mountInbox(tool, language, config, all, {
            request,
            onLogout: () => {
              auth.signOut();
              login();
            },
          });
      }
      body.querySelectorAll("[data-tool]").forEach(
        (b) =>
          (b.onclick = () => {
            history.replaceState(
              null,
              "",
              `#/${language}/admin/${b.dataset.tool}`
            );
            show(b.dataset.tool);
          })
      );
      await show(location.hash.endsWith("/inbox") ? "inbox" : "maps");
    } catch (e) {
      if (!disposed)
        connectionError(e) ? reconnect(workspace) : login(e.message);
    }
  }
  try {
    await auth.configure();
    try {
      await auth.token();
      await workspace();
    } catch (e) {
      connectionError(e) ? reconnect(workspace) : login();
    }
  } catch (e) {
    if (connectionError(e)) reconnect(() => location.reload());
    else body.textContent = e.message;
  }
  return () => {
    if (disposed) return;
    disposed = true;
    generation++;
    disposeTool();
    headerObserver.disconnect();
    root.style.removeProperty("--admin-header-height");
    root.classList.remove("admin-portal");
  };
}
