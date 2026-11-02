import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from "amazon-cognito-identity-js";
let pool, user, challenge, label;
export async function configure() {
  const r = await fetch("./admin-auth.json", { cache: "no-store" });
  if (!r.ok) throw Error("Admin sign-in is being configured.");
  const c = await r.json();
  pool = new CognitoUserPool({
    UserPoolId: c.userPoolId,
    ClientId: c.clientId,
    Storage: sessionStorage,
  });
  user = pool.getCurrentUser();
}
export async function token() {
  if (!user) throw Error("Please sign in.");
  return new Promise((resolve, reject) =>
    user.getSession((e, s) => {
      if (e || !s?.isValid())
        return reject(Error("Your session expired. Please sign in."));
      label = s.getIdToken().payload.email;
      resolve(s.getAccessToken().getJwtToken());
    })
  );
}
function callbacks(resolve, reject) {
  return {
    onSuccess: () => {
      challenge = null;
      resolve({ signedIn: true });
    },
    onFailure: reject,
    newPasswordRequired: (attributes) => {
      challenge = { kind: "password", attributes };
      resolve({ challenge: "password" });
    },
    mfaRequired: () => {
      challenge = { kind: "mfa" };
      resolve({ challenge: "mfa" });
    },
    totpRequired: () => {
      challenge = { kind: "totp" };
      resolve({ challenge: "totp" });
    },
  };
}
export async function signIn(email, password) {
  user = new CognitoUser({
    Username: email,
    Pool: pool,
    Storage: sessionStorage,
  });
  return new Promise((resolve, reject) =>
    user.authenticateUser(
      new AuthenticationDetails({ Username: email, Password: password }),
      callbacks(resolve, reject)
    )
  );
}
export async function answer(value) {
  return new Promise((resolve, reject) => {
    const c = callbacks(resolve, reject);
    if (challenge?.kind === "password")
      user.completeNewPasswordChallenge(value, {}, c);
    else
      user.sendMFACode(
        value,
        c,
        challenge?.kind === "totp" ? "SOFTWARE_TOKEN_MFA" : undefined
      );
  });
}
export function signOut() {
  user?.signOut();
  user = null;
  label = null;
  challenge = null;
}
export function forgot(email) {
  user = new CognitoUser({
    Username: email,
    Pool: pool,
    Storage: sessionStorage,
  });
  return new Promise((resolve, reject) =>
    user.forgotPassword({
      onSuccess: resolve,
      onFailure: reject,
      inputVerificationCode: resolve,
    })
  );
}
export function reset(code, password) {
  return new Promise((resolve, reject) =>
    user.confirmPassword(code, password, {
      onSuccess: resolve,
      onFailure: reject,
    })
  );
}

export function accountLabel() {
  return label || user?.getUsername() || "Operator";
}
