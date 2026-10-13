import assert from "node:assert/strict";
import test from "node:test";
import { createCloudStore } from "../src/cloud.js";

function fakeClient() {
  const state = { revision: 0, fights: [], contacts: [] };
  return {
    state,
    from() { return { select() { return { eq() { return {
      async single() { return { data: structuredClone(state), error: null }; },
    }; } }; } }; },
    async rpc(name, args) {
      assert.equal(name, "save_club_state");
      if (args.expected_revision !== state.revision) return { data: [], error: null };
      state.fights = structuredClone(args.next_fights);
      state.contacts = structuredClone(args.next_contacts);
      state.revision++;
      return { data: [{ revision: state.revision }], error: null };
    },
  };
}

test("dos navegadores no sobrescriben cambios; el segundo debe actualizar", async () => {
  const client = fakeClient();
  const first = createCloudStore(client), second = createCloudStore(client);
  await first.load(); await second.load();
  await first.save([{ id: "pelea-1" }], [{ name: "Ana", phone: "123" }]);
  await assert.rejects(second.save([], []), /Otra persona/);
  assert.equal(client.state.fights[0].id, "pelea-1");
  assert.equal(client.state.contacts[0].phone, "123");
  const latest = await second.load();
  await second.save([...latest.fights, { id: "pelea-2" }], latest.contacts);
  assert.equal(client.state.fights.length, 2);
});

test("rechaza guardado sin cargar y propaga errores de acceso o conexión", async () => {
  const client = fakeClient(), store = createCloudStore(client);
  await assert.rejects(store.save([], []), /Primero cargá/);
  await store.load();
  client.rpc = async () => ({ data: null, error: new Error("Sin conexión") });
  await assert.rejects(store.save([], []), /Sin conexión/);
  assert.equal(client.state.revision, 0);
});
