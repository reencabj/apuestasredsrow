export function createCloudStore(client) {
  let revision = null;
  return {
    async load() {
      const { data, error } = await client.from("club_state")
        .select("fights,contacts,revision").eq("id", 1).single();
      if (error) throw error;
      revision = data.revision;
      return data;
    },
    async save(fights, contacts) {
      if (revision === null) throw new Error("Primero cargá los datos compartidos.");
      const { data, error } = await client.rpc("save_club_state", {
        expected_revision: revision, next_fights: fights, next_contacts: contacts,
      });
      if (error) throw error;
      if (!data?.length) throw new Error("Otra persona actualizó los datos. Actualizá y repetí el cambio.");
      revision = data[0].revision;
    },
  };
}
