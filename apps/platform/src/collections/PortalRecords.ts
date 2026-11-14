import type { Access, CollectionConfig } from 'payload'

const isAdministrator: Access = ({ req }) => req.user?.collection === 'users'
const deny: Access = () => false

/**
 * Trajni zapis stanja kandidatskog portala (ranije `.data/portal-store.json`, koji se brisao pri
 * svakom deploy-u). Jedan red po kandidatu, plus jedan red `kind = settings` za pozivnice,
 * obaveštenja, FAQ, promocije i sadržaj sajta. Dokumenta se ne čuvaju ovde nego šifrovano u
 * `portal-documents`.
 *
 * Upis ide isključivo preko serverskog koda (`modules/portal-sync`), nikad preko REST-a.
 */
export const PortalRecords: CollectionConfig = {
  slug: 'portal-records',
  access: {
    create: deny,
    delete: deny,
    read: isAdministrator,
    update: deny,
  },
  admin: {
    defaultColumns: ['key', 'kind', 'email', 'updatedAt'],
    description: 'Stanje kandidatskog portala. Menja se samo kroz portal i admin panel.',
    group: 'Kandidatski portal',
    useAsTitle: 'key',
  },
  fields: [
    { name: 'key', type: 'text', index: true, required: true, unique: true },
    {
      name: 'kind',
      type: 'select',
      defaultValue: 'candidate',
      index: true,
      options: [
        { label: 'Kandidat', value: 'candidate' },
        { label: 'Podešavanja portala', value: 'settings' },
      ],
      required: true,
    },
    { name: 'email', type: 'text', index: true },
    { name: 'data', type: 'json', required: true },
  ],
  labels: { plural: 'Zapisi portala', singular: 'Zapis portala' },
  timestamps: true,
}
