import type { Access, CollectionConfig, Where } from 'payload'

const administratorOrOwnInvoice: Access = ({ req }) => {
  if (req.user?.collection === 'users') return true
  if (req.user?.collection !== 'candidate-accounts') return false
  const email = String((req.user as { email?: string }).email || '').toLowerCase()
  const own: Where[] = [{ candidateAccount: { equals: req.user.id } }, { portalEmail: { equals: email } }]
  return { or: own }
}

const deny = () => false

export const CandidateInvoices: CollectionConfig = {
  slug: 'candidate-invoices',
  access: {
    create: deny,
    delete: deny,
    read: administratorOrOwnInvoice,
    update: deny,
  },
  admin: {
    defaultColumns: ['invoiceNumber', 'buyerName', 'settlementAmountRsdCents', 'issueDate', 'candidateAccount'],
    description: 'Baza izdatih faktura kandidatima i evidencija za KIR knjigu.',
    group: 'Finansije',
    useAsTitle: 'invoiceNumber',
  },
  fields: [
    { name: 'invoiceNumber', type: 'text', admin: { readOnly: true }, index: true, required: true, unique: true },
    { name: 'sequenceNumber', type: 'number', admin: { readOnly: true }, index: true, required: true },
    { name: 'year', type: 'number', admin: { readOnly: true }, index: true, required: true },
    { name: 'candidateAccount', type: 'relationship', admin: { readOnly: true }, relationTo: 'candidate-accounts' },
    { name: 'candidateProcess', type: 'relationship', admin: { readOnly: true }, relationTo: 'candidate-processes' },
    { name: 'preApplication', type: 'relationship', admin: { readOnly: true }, relationTo: 'pre-applications' },
    { name: 'candidatePayment', type: 'relationship', admin: { readOnly: true }, relationTo: 'candidate-payments', unique: true },
    { name: 'issuedBy', type: 'relationship', admin: { readOnly: true }, relationTo: 'users', required: true },
    { name: 'buyerName', type: 'text', admin: { readOnly: true }, required: true },
    { name: 'buyerAddress', type: 'text', admin: { readOnly: true }, required: true },
    { name: 'buyerTaxId', type: 'text', admin: { readOnly: true } },
    { name: 'originalAmountCents', type: 'number', admin: { readOnly: true }, required: true },
    {
      name: 'originalCurrency',
      type: 'select',
      admin: { readOnly: true },
      options: [
        { label: 'USD', value: 'USD' },
        { label: 'EUR', value: 'EUR' },
        { label: 'RSD', value: 'RSD' },
      ],
      required: true,
    },
    { name: 'exchangeRateScaled', type: 'number', admin: { readOnly: true }, required: true },
    { name: 'exchangeRateDate', type: 'date', admin: { readOnly: true }, required: true },
    { name: 'exchangeRateSource', type: 'text', admin: { readOnly: true } },
    { name: 'settlementAmountRsdCents', type: 'number', admin: { readOnly: true }, required: true },
    { name: 'amountInWords', type: 'text', admin: { readOnly: true }, required: true },
    { name: 'issueDate', type: 'date', admin: { readOnly: true }, required: true },
    { name: 'accountingDate', type: 'date', admin: { readOnly: true }, required: true },
    { name: 'note', type: 'textarea', admin: { readOnly: true } },
    { name: 'pdfSha256', type: 'text', admin: { readOnly: true }, required: true },
    // Bez eksplicitne granice Payload dozvoljava samo 40.000 znakova (≈30 KB PDF-a).
    { name: 'pdfBase64', type: 'textarea', access: { read: deny }, admin: { hidden: true }, maxLength: 4_000_000 },
    // Fakture za uplate potvrđene kroz kandidatski portal (portal-records). Domenske veze iznad su
    // tada prazne; numeracija FAKT-GGGG-NNNN i KIR su zajednički.
    { name: 'portalRecordKey', type: 'text', admin: { readOnly: true }, index: true },
    { name: 'portalEmail', type: 'text', admin: { readOnly: true }, index: true },
    { name: 'portalInstallment', type: 'text', admin: { readOnly: true }, label: 'Rata (portal)' },
    { name: 'paymentReceivedAt', type: 'date', admin: { readOnly: true }, label: 'Datum prijema uplate' },
    { name: 'paymentReference', type: 'text', admin: { readOnly: true }, label: 'Poziv na broj / izvod', maxLength: 160 },
  ],
  labels: { plural: 'Fakture i računi (KIR)', singular: 'Faktura' },
}
