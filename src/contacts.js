export function searchName(value) {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

export function rememberContact(contacts, name, phone) {
  const contact = { name: name.trim(), phone: phone.trim() };
  if (!contact.name || !contact.phone) return contacts;
  return [contact, ...contacts.filter((item) =>
    searchName(item.name) !== searchName(contact.name) || item.phone !== contact.phone)];
}

export function matchingContacts(contacts, query) {
  const key = searchName(query);
  return key ? contacts.filter((contact) => searchName(contact.name).includes(key)) : [];
}
