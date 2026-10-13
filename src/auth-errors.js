export function authErrorMessage(error) {
  if (["otp_expired", "access_denied"].includes(error?.code)) {
    return "El enlace de recuperación venció o ya fue usado. Pedí uno nuevo con Olvidé mi contraseña y abrí solo el correo más reciente.";
  }
  if (error?.code === "invalid_credentials") {
    return "Email o contraseña incorrectos. Usá la contraseña de esta app; si no la recordás, pulsá Olvidé mi contraseña.";
  }
  if (error?.code === "email_not_confirmed") return "Confirmá tu email antes de entrar.";
  return "No se pudo ingresar. Revisá la conexión y volvé a intentar.";
}

export function recoveryLinkError(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.has("error") || params.has("error_code")
    ? authErrorMessage({ code: params.get("error_code") || params.get("error") }) : null;
}
