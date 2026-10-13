import assert from "node:assert/strict";
import test from "node:test";
import { authErrorMessage, recoveryLinkError } from "../src/auth-errors.js";

test("un enlace vencido explica cómo pedir otro y no expone tokens", () => {
  assert.match(recoveryLinkError("#error=access_denied&error_code=otp_expired"), /correo más reciente/);
  assert.equal(recoveryLinkError("#type=recovery&access_token=private"), null);
});
test("distingue credenciales incorrectas de confirmación y conexión", () => {
  assert.match(authErrorMessage({ code: "invalid_credentials" }), /Email o contraseña incorrectos/);
  assert.match(authErrorMessage({ code: "email_not_confirmed" }), /Confirmá/);
  assert.match(authErrorMessage(new Error("network")), /conexión/);
});
