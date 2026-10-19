// prisma/seed.ts
// Pre-seeds Bhagavan Naama Sathsangam Seva Trust governance, auto-coded starter ledgers,
// initial Rs. 1,000/- Founder Corpus (Clause 5.2), and Trust Deed Budget Categories.

import { PrismaClient, AccountType, Role, SystemLedgerTag, SpecifiedPersonType, FundType, PaymentMethod, TransactionStatus, VoucherType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Helper to auto-assign the next 4-digit Ledger Code based on AccountType:
 * LIABILITY_FUND: 1001 - 1999
 * ASSET:          2001 - 2999
 * INCOME:         3001 - 3999
 * EXPENSE:        4001 - 4999
 */
export async function generateNextLedgerCode(accountType: AccountType): Promise<string> {
  const prefixMap: Record<AccountType, number> = {
    LIABILITY_FUND: 1000,
    ASSET: 2000,
    INCOME: 3000,
    EXPENSE: 4000,
  };
  const base = prefixMap[accountType];
  const minCode = String(base + 1);
  const maxCode = String(base + 999);

  const latestLedger = await prisma.ledgerAccount.findFirst({
    where: {
      accountType,
      code: { gte: minCode, lte: maxCode },
    },
    orderBy: { code: 'desc' },
  });

  if (!latestLedger) {
    return String(base + 1);
  }
  return String( parseInt(latestLedger.code, 10) + 1 );
}

async function main() {
  console.log('Seeding Bhagavan Naama Sathsangam Seva Trust Portal...');

  // 1. Trust Settings (From Registered Deed R/Podumbu/Book-4/71/2026)
  await prisma.trustSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      trustName: 'BHAGAVAN NAAMA SATHSANGAM SEVA TRUST',
      tagline: 'SINCE 1990',
      deedRegistrationNo: 'R/Podumbu/Book-4/71/2026',
      deedRegistrationDate: '2026-09-30',
      subRegistrarOffice: 'Podumbu, Madurai North',
      registeredOfficeAddress: 'No. 4/355, First Floor, Rajaji Street, EB Colony, Anaiyur, Madurai, Tamil Nadu - 625017',
      authorisedSignatory1Name: 'G. Ramakrishnan',
      authorisedSignatory2Name: 'S. Sivarama Krishnan',
      logoUrl: '/assets/trust-logo.png',
    },
  });

  // 2. First Board of Trustees (From Trust Deed Pages 1, 2, 6, 8)
  const trustees = [
    {
      fullName: 'R. Meenakshi Sundaram',
      designation: 'Founder, Author & Managing Trustee',
      phone: '9944071183',
      panNumber: 'DMMPM1553F',
      address: 'No. 4/355, Ground Floor, Rajaji Street, EB Colony, Anaiyur, Madurai, Tamil Nadu - 625017',
      role: Role.MANAGING_TRUSTEE,
      specifiedType: SpecifiedPersonType.FOUNDER_MANAGING_TRUSTEE,
      city: 'Madurai',
      pinCode: '625017',
    },
    {
      fullName: 'Ramakrishnan Gopalakrishnan',
      designation: 'Trustee & Joint Authorised Signatory',
      phone: '9003565966',
      panNumber: 'BYXPR8106E',
      address: 'Flat No. 1A, A Block, 1st Floor, Agraharam, Singanallur, Paaru Apartment, East Street, Coimbatore, Tamil Nadu - 641005',
      role: Role.AUTHORISED_SIGNATORY_TRUSTEE,
      specifiedType: SpecifiedPersonType.TRUSTEE,
      city: 'Coimbatore',
      pinCode: '641005',
    },
    {
      fullName: 'Sivaramakrishnan Sridhar',
      designation: 'Trustee & Joint Authorised Signatory',
      phone: '8148666297',
      panNumber: 'FUYPS9172L',
      address: '7/7, North Street, Sathy Main Road, Kurumbapalayam, Coimbatore, Tamil Nadu - 641107',
      role: Role.AUTHORISED_SIGNATORY_TRUSTEE,
      specifiedType: SpecifiedPersonType.TRUSTEE,
      city: 'Coimbatore',
      pinCode: '641107',
    },
    {
      fullName: 'Ganesh Sekar',
      designation: 'Trustee',
      phone: '7358422299',
      panNumber: 'ITYPS3434M',
      address: 'Villa 34, Aadrudhra Enclave, Athipalayam Salai, Saravanampatti, Coimbatore, Tamil Nadu - 641035',
      role: Role.TRUSTEE,
      specifiedType: SpecifiedPersonType.TRUSTEE,
      city: 'Coimbatore',
      pinCode: '641035',
    },
    {
      fullName: 'Shyam Sundar Gopalakrishnan',
      designation: 'Trustee',
      phone: '8870219438',
      panNumber: 'NDJPS1470K',
      address: 'Flat No. 1A, Paaru Apartments, East Street, Singanallur, Agraharam, Coimbatore, Tamil Nadu - 641005',
      role: Role.TRUSTEE,
      specifiedType: SpecifiedPersonType.TRUSTEE,
      city: 'Coimbatore',
      pinCode: '641005',
    },
    {
      fullName: 'Meera Shankar',
      designation: 'Trustee',
      phone: '8925200127',
      panNumber: 'CEZPM7283N',
      address: 'No. 4/355, Ground Floor, Rajaji Street, EB Colony, Anaiyur, Madurai, Tamil Nadu - 625017',
      role: Role.TRUSTEE,
      specifiedType: SpecifiedPersonType.TRUSTEE,
      city: 'Madurai',
      pinCode: '625017',
    },
    {
      fullName: 'Suriyanarayanan K',
      designation: 'Trustee',
      phone: '9894740573',
      panNumber: 'MTRPK9520M',
      address: 'No. 30B/1, Janaatha Nagar West, Periyar Street, Sivanandapuram, Coimbatore, Tamil Nadu - 641035',
      role: Role.TRUSTEE,
      specifiedType: SpecifiedPersonType.TRUSTEE,
      city: 'Coimbatore',
      pinCode: '641035',
    },
  ];

  let founderUserId = '';
  let founderDonorId = '';

  for (let i = 0; i < trustees.length; i++) {
    const t = trustees[i];
    const user = await prisma.user.upsert({
      where: { phone: t.phone },
      update: {},
      create: {
        fullName: t.fullName,
        designation: t.designation,
        phone: t.phone,
        panNumber: t.panNumber,
        address: t.address,
        role: t.role,
      },
    });

    const donor = await prisma.donor.upsert({
      where: { phone: t.phone },
      update: {},
      create: {
        donorCode: `DNR-2026-000${i + 1}`,
        fullName: t.fullName,
        phone: t.phone,
        panNumber: t.panNumber,
        addressLine1: t.address,
        city: t.city,
        state: 'Tamil Nadu',
        pinCode: t.pinCode,
        specifiedPersonType: t.specifiedType,
      },
    });

    if (i === 0) {
      founderUserId = user.id;
      founderDonorId = donor.id;
    }
  }

  // 3. Starter Ledgers (All Renameable & Extensible in UI with Auto-Assigned Codes)
  const starterLedgers: Array<{
    name: string;
    accountType: AccountType;
    tallyParentGroup: string;
    systemTag?: SystemLedgerTag;
    isCorpusFund?: boolean;
    isSec11_5ApprovedMode?: boolean;
  }> = [
    // 1xxx - Funds & Liabilities
    { name: 'Trust Corpus Fund', accountType: AccountType.LIABILITY_FUND, tallyParentGroup: 'Capital Account', systemTag: SystemLedgerTag.CORPUS_DEFAULT, isCorpusFund: true },
    { name: 'General Trust Fund & Surplus', accountType: AccountType.LIABILITY_FUND, tallyParentGroup: 'Capital Account', systemTag: SystemLedgerTag.GENERAL_SURPLUS },
    { name: 'Seetha-Radha Kalyana Mahotsavam Fund', accountType: AccountType.LIABILITY_FUND, tallyParentGroup: 'Current Liabilities' },
    { name: 'TDS Payable', accountType: AccountType.LIABILITY_FUND, tallyParentGroup: 'Duties & Taxes', systemTag: SystemLedgerTag.TDS_PAYABLE },

    // 2xxx - Assets, Bank & Cash
    { name: 'Primary Trust Bank Account', accountType: AccountType.ASSET, tallyParentGroup: 'Bank Accounts', systemTag: SystemLedgerTag.BANK_PRIMARY, isSec11_5ApprovedMode: true },
    { name: 'Corpus Bank / FD Account (Sec 11(5))', accountType: AccountType.ASSET, tallyParentGroup: 'Deposits (Asset)', systemTag: SystemLedgerTag.FD_SEC_11_5, isSec11_5ApprovedMode: true },
    { name: 'Razorpay Settlement Clearing A/c', accountType: AccountType.ASSET, tallyParentGroup: 'Current Assets', systemTag: SystemLedgerTag.RAZORPAY_CLEARING },
    { name: 'Cash on Hand', accountType: AccountType.ASSET, tallyParentGroup: 'Cash-in-Hand', systemTag: SystemLedgerTag.CASH_MAIN },
    { name: 'Petty Cash', accountType: AccountType.ASSET, tallyParentGroup: 'Cash-in-Hand', systemTag: SystemLedgerTag.PETTY_CASH },

    // 3xxx - Incomes (Aligned with Trust Deed Clauses 1.1 - 1.20)
    { name: 'General Voluntary Donations', accountType: AccountType.INCOME, tallyParentGroup: 'Direct Incomes', systemTag: SystemLedgerTag.INCOME_GENERAL_DEFAULT },
    { name: 'Seetha-Radha Kalyana Mahotsavam Contributions', accountType: AccountType.INCOME, tallyParentGroup: 'Direct Incomes' },
    { name: 'Annadanam & Prasadam Donations', accountType: AccountType.INCOME, tallyParentGroup: 'Direct Incomes' },
    { name: 'Bhajan, Satsang & Utsavam Sponsorships', accountType: AccountType.INCOME, tallyParentGroup: 'Direct Incomes' },
    { name: 'Bank & FD Interest Income', accountType: AccountType.INCOME, tallyParentGroup: 'Indirect Incomes' },

    // 4xxx - Expenses (Aligned with Trust Deed Clauses 1.1 - 1.20)
    { name: 'Seetha-Radha Kalyana Mahotsavam Expenses', accountType: AccountType.EXPENSE, tallyParentGroup: 'Direct Expenses' },
    { name: 'Utsavam, Bhajan, Kirtan & Pooja Expenses', accountType: AccountType.EXPENSE, tallyParentGroup: 'Direct Expenses' },
    { name: 'Annadanam & Devotee Prasadam Expenses', accountType: AccountType.EXPENSE, tallyParentGroup: 'Direct Expenses' },
    { name: 'Pravachanam, Spiritual Books & Cultural Heritage', accountType: AccountType.EXPENSE, tallyParentGroup: 'Direct Expenses' },
    { name: 'Student Educational Support & Medical Camp Aid', accountType: AccountType.EXPENSE, tallyParentGroup: 'Direct Expenses' },
    { name: 'Rent, Utilities & Office Maintenance', accountType: AccountType.EXPENSE, tallyParentGroup: 'Indirect Expenses' },
    { name: 'Audit, Legal & Statutory Filing Fees', accountType: AccountType.EXPENSE, tallyParentGroup: 'Indirect Expenses' },
    { name: 'Payment Gateway & Bank Charges', accountType: AccountType.EXPENSE, tallyParentGroup: 'Indirect Expenses', systemTag: SystemLedgerTag.EXPENSE_GATEWAY_FEES },
  ];

  const ledgerByName: Record<string, string> = {};

  for (const item of starterLedgers) {
    const existing = await prisma.ledgerAccount.findUnique({ where: { name: item.name } });
    if (!existing) {
      const nextCode = await generateNextLedgerCode(item.accountType);
      const created = await prisma.ledgerAccount.create({
        data: {
          code: nextCode,
          name: item.name,
          accountType: item.accountType,
          tallyParentGroup: item.tallyParentGroup,
          systemTag: item.systemTag,
          isCorpusFund: item.isCorpusFund ?? false,
          isSec11_5ApprovedMode: item.isSec11_5ApprovedMode ?? false,
        },
      });
      ledgerByName[item.name] = created.id;
    } else {
      ledgerByName[item.name] = existing.id;
    }
  }

  // 4. Record Initial Founder Corpus Contribution of Rs. 1,000/- (Clause 5.2 of Trust Deed, 30-09-2026)
  const existingFounderReceipt = await prisma.donation.findUnique({
    where: { receiptNumber: 'BNST-RCPT-2026-27-0001' },
  });

  if (!existingFounderReceipt && founderDonorId && founderUserId) {
    const cashLedgerId = ledgerByName['Cash on Hand'];
    const corpusLedgerId = ledgerByName['Trust Corpus Fund'];

    const journal = await prisma.journalEntry.create({
      data: {
        voucherNumber: 'BNST-RCPT-2026-27-0001',
        voucherType: VoucherType.RECEIPT,
        financialYear: '2026-27',
        entryDate: new Date('2026-09-30T10:00:00+05:30'),
        narration: 'Initial Founder Corpus Contribution as per Clause 5.2 of Trust Deed R/Podumbu/Book-4/71/2026 by R. Meenakshi Sundaram',
        createdById: founderUserId,
        lines: {
          create: [
            { ledgerId: cashLedgerId, debit: 1000.00, credit: 0 },
            { ledgerId: corpusLedgerId, debit: 0, credit: 1000.00 },
          ],
        },
      },
    });

    await prisma.donation.create({
      data: {
        receiptNumber: 'BNST-RCPT-2026-27-0001',
        financialYear: '2026-27',
        donationDate: new Date('2026-09-30T10:00:00+05:30'),
        donorId: founderDonorId,
        amount: 1000.00,
        fundType: FundType.CORPUS_11_1_D,
        paymentMethod: PaymentMethod.CASH,
        status: TransactionStatus.REALIZED,
        incomeOrFundLedgerId: corpusLedgerId,
        assetLedgerId: cashLedgerId,
        corpusDirectionConfirmed: true,
        corpusDirectionNote: 'Clause 2.1 & 5.2 of Registered Trust Deed R/Podumbu/Book-4/71/2026 dated 30-09-2026',
        journalEntryId: journal.id,
        createdById: founderUserId,
      },
    });

    await prisma.donor.update({
      where: { id: founderDonorId },
      data: { lifetimeDonated: 1000.00 },
    });
  }

  // 5. Starter Budget Categories (Mapped to Trust Deed Objectives)
  const starterBudgets = [
    { code: 'BDG-01', name: 'Seetha-Radha Kalyana Mahotsavam', deedObjectiveRef: 'Clause 1.2 & 1.16', ledgerName: 'Seetha-Radha Kalyana Mahotsavam Expenses', amount: 300000 },
    { code: 'BDG-02', name: 'Utsavams, Bhajans, Kirtans & Daily Pooja', deedObjectiveRef: 'Clause 1.1, 1.3 & 1.8', ledgerName: 'Utsavam, Bhajan, Kirtan & Pooja Expenses', amount: 150000 },
    { code: 'BDG-03', name: 'Annadanam & Devotee Prasadam', deedObjectiveRef: 'Clause 1.12 & 1.13', ledgerName: 'Annadanam & Devotee Prasadam Expenses', amount: 250000 },
    { code: 'BDG-04', name: 'Vedic Literature, Spiritual Publications & Youth Programs', deedObjectiveRef: 'Clause 1.9, 1.11 & 1.15', ledgerName: 'Pravachanam, Spiritual Books & Cultural Heritage', amount: 75000 },
    { code: 'BDG-05', name: 'Student Aid & Free Medical Camps', deedObjectiveRef: 'Clause 1.19 & 1.20', ledgerName: 'Student Educational Support & Medical Camp Aid', amount: 100000 },
    { code: 'BDG-06', name: 'Trust Administration, Rent & Audit', deedObjectiveRef: 'Clause 6.21', ledgerName: 'Rent, Utilities & Office Maintenance', amount: 60000 },
  ];

  for (const b of starterBudgets) {
    const cat = await prisma.budgetCategory.upsert({
      where: { code: b.code },
      update: {},
      create: {
        code: b.code,
        name: b.name,
        deedObjectiveRef: b.deedObjectiveRef,
        defaultLedgerId: ledgerByName[b.ledgerName],
      },
    });

    await prisma.budgetAllocation.upsert({
      where: {
        financialYear_budgetCategoryId: {
          financialYear: '2026-27',
          budgetCategoryId: cat.id,
        },
      },
      update: {},
      create: {
        financialYear: '2026-27',
        budgetCategoryId: cat.id,
        allocatedAmount: b.amount,
        alertThresholdPct: 80,
      },
    });
  }

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
