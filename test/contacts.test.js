import assert from "node:assert/strict";
import test from "node:test";
import { matchingContacts, rememberContact } from "../src/contacts.js";

test("buscar por nombre parcial ignora mayúsculas y acentos", () => {
  const contacts = rememberContact([], "Agustín Santos", "099123456");
  assert.deepEqual(matchingContacts(contacts, " AGUSTIN "), contacts);
  assert.deepEqual(matchingContacts(contacts, "santos"), contacts);
  assert.deepEqual(matchingContacts(contacts, ""), []);
  assert.deepEqual(matchingContacts(contacts, "Pedro"), []);
});

test("no duplica personas y distingue dos números con el mismo nombre", () => {
  let contacts = rememberContact([], "Agustín Santos", "099123456");
  contacts = rememberContact(contacts, " Agustin Santos ", " 099123456 ");
  assert.equal(contacts.length, 1);
  contacts = rememberContact(contacts, "Agustin Santos", "098765432");
  assert.equal(matchingContacts(contacts, "agustin").length, 2);
  assert.equal(contacts[0].phone, "098765432");
  assert.equal(rememberContact(contacts, "", "123"), contacts);
});
