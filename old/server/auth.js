import { Router } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { ConfidentialClientApplication, CryptoProvider } from "@azure/msal-node";
import crypto from "node:crypto";
import { pool } from "./db.js";

const {
  AZURE_TENANT_ID,
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  APP_BASE_URL,
  SESSION_SECRET,
  REQUIRE_ROLES,
} = process.env;

export const authConfigured = Boolean(AZURE_TENANT_ID && AZURE_CLIENT_ID && AZURE_CLIENT_SECRET);

const baseUrl = (APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const redirectUri = `${baseUrl}/auth/callback`;
const requireRolesStrictly = REQUIRE_ROLES === "true";

export const ROLES = { BOUQUET: "BouquetTeam", MERCH: "Merchandiser" };

const DEMO_USER = {
  oid: "demo",
  name: "Demo user",
  email: "demo@wafex.local",
  roles: [ROLES.BOUQUET, ROLES.MERCH],
  demo: true,
};

const msal = authConfigured
  ? new ConfidentialClientApplication({
      auth: {
        clientId: AZURE_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
        clientSecret: AZURE_CLIENT_SECRET,
      },
    })
  : null;

const cryptoProvider = new CryptoProvider();

// ---------- Sessions (stored in Postgres so they survive restarts) ----------

export function sessionMiddleware() {
  const PgStore = connectPgSimple(session);
  const secret = SESSION_SECRET || crypto.randomBytes(32).toString("hex");
  if (!SESSION_SECRET && authConfigured)
    console.warn("SESSION_SECRET not set — sessions will be invalidated on every deploy. Set it in Railway variables.");
  return session({
    store: new PgStore({ pool, createTableIfMissing: true }),
    name: "wafex.sid",
    secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: baseUrl.startsWith("https"),
      maxAge: 8 * 60 * 60 * 1000, // one working day
    },
  });
}

// ---------- Role helpers ----------

/**
 * If the Entra app registration has no app roles assigned yet, tokens carry no
 * roles claim. Unless REQUIRE_ROLES=true, treat those users as having full
 * access so SSO can be rolled out before roles are configured.
 */
export function hasRole(user, role) {
  if (!user) return false;
  if (user.roles?.includes(role)) return true;
  return !requireRolesStrictly && (!user.roles || user.roles.length === 0);
}

export function permissionsFor(user) {
  return {
    approveCredits: hasRole(user, ROLES.BOUQUET),
    logVisits: hasRole(user, ROLES.MERCH) || hasRole(user, ROLES.BOUQUET),
  };
}

// ---------- Middleware ----------

export function requireAuth(req, res, next) {
  if (!authConfigured) {
    req.user = DEMO_USER;
    return next();
  }
  if (req.session?.user) {
    req.user = req.session.user;
    return next();
  }
  res.status(401).json({ error: "unauthenticated" });
}

export function requireRole(role) {
  return (req, res, next) => {
    if (hasRole(req.user, role)) return next();
    res.status(403).json({ error: `This action needs the ${role} role. Ask an admin to assign it in Microsoft Entra.` });
  };
}

// ---------- Routes ----------

export function authRouter() {
  const r = Router();

  r.get("/auth/login", async (req, res, next) => {
    try {
      if (!authConfigured) return res.redirect("/");
      const { verifier, challenge } = await cryptoProvider.generatePkceCodes();
      const state = cryptoProvider.createNewGuid();
      req.session.pkceVerifier = verifier;
      req.session.authState = state;
      const url = await msal.getAuthCodeUrl({
        scopes: ["openid", "profile", "email"],
        redirectUri,
        responseMode: "query",
        codeChallenge: challenge,
        codeChallengeMethod: "S256",
        state,
        prompt: "select_account",
      });
      res.redirect(url);
    } catch (e) {
      next(e);
    }
  });

  r.get("/auth/callback", async (req, res) => {
    try {
      if (!authConfigured) return res.redirect("/");
      const { code, state, error, error_description } = req.query;
      if (error) throw new Error(error_description || error);
      if (!code || !state || state !== req.session.authState)
        throw new Error("Sign-in state didn't match — please try again.");
      const result = await msal.acquireTokenByCode({
        code,
        scopes: ["openid", "profile", "email"],
        redirectUri,
        codeVerifier: req.session.pkceVerifier,
      });
      const c = result.idTokenClaims ?? {};
      const user = {
        oid: c.oid,
        name: c.name || c.preferred_username || "Signed-in user",
        email: c.preferred_username || c.email || "",
        roles: Array.isArray(c.roles) ? c.roles : [],
      };
      delete req.session.pkceVerifier;
      delete req.session.authState;
      // Rotate the session id on login to prevent fixation.
      req.session.regenerate((err) => {
        if (err) throw err;
        req.session.user = user;
        req.session.save(() => res.redirect("/"));
      });
    } catch (e) {
      console.error("Auth callback failed:", e.message);
      res.redirect(`/?authError=${encodeURIComponent(e.message.slice(0, 180))}`);
    }
  });

  r.get("/auth/logout", (req, res) => {
    const finish = () => {
      if (authConfigured) {
        const url = new URL(`https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/logout`);
        url.searchParams.set("post_logout_redirect_uri", baseUrl);
        res.redirect(url.toString());
      } else {
        res.redirect("/");
      }
    };
    if (req.session) req.session.destroy(finish);
    else finish();
  });

  return r;
}
