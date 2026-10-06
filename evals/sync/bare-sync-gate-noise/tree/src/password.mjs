export function strongEnough(password) {
  return typeof password === "string" && password.length >= 8;
}
