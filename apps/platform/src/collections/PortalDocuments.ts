import type { Access, CollectionConfig } from 'payload'

const isAdministrator: Access = ({ req }) => req.user?.collection === 'users'
const deny: Access = () => false
const denyField = () => false
const neverExpose = { read: denyField, update: denyField }

/**
 * Dokumenta koja kandidat ili agencija otpreme kroz portal (pasoš, CV, uverenja, potpisan
 * ugovor…). Sadržaj je šifrovan AES-256-GCM istim ključevima kao `candidate-private-documents`
 * (SENSITIVE_DATA_*), a čita se samo kroz `/api/public/documents/upload?doc=<id>` uz proveru
 * vlasništva.
 */
export const PortalDocuments: CollectionConfig = {
  slug: 'portal-documents',
  access: {
    create: deny,
    delete: deny,
    read: isAdministrator,
    update: deny,
  },
  admin: {
    defaultColumns: ['email', 'field', 'fileName', 'sizeBytes', 'createdAt'],
    group: 'Kandidatski portal',
    useAsTitle: 'fileName',
  },
  fields: [
    { name: 'recordKey', type: 'text', index: true, required: true },
    { name: 'email', type: 'text', index: true, required: true },
    { name: 'field', type: 'text', label: 'Vrsta (polje u dosijeu)', required: true },
    { name: 'fileName', type: 'text', required: true },
    { name: 'mimeType', type: 'text', required: true },
    { name: 'sizeBytes', type: 'number', min: 1, required: true },
    { name: 'sha256', type: 'text', access: { update: denyField }, admin: { hidden: true }, required: true },
    { name: 'ciphertext', type: 'textarea', access: neverExpose, admin: { hidden: true }, required: true },
    { name: 'iv', type: 'text', access: neverExpose, admin: { hidden: true }, required: true },
    { name: 'authTag', type: 'text', access: neverExpose, admin: { hidden: true }, required: true },
    { name: 'keyId', type: 'text', access: neverExpose, admin: { hidden: true }, required: true },
  ],
  labels: { plural: 'Dokumenta portala', singular: 'Dokument portala' },
  timestamps: true,
}
