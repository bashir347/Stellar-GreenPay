// __mocks__/@stellar/stellar-sdk.js
//
// Jest stand-in for `@stellar/stellar-sdk`, applied automatically to every
// suite because it lives in `__mocks__` next to `node_modules` (same pattern
// as `__mocks__/axios.js` and `__mocks__/expo-secure-store.js`).
//
// The package cannot run under jest-expo: the SDK's CJS entry requires
// ESM-only dependencies (`uint8array-extras`, `@noble/hashes`) that the
// transform pipeline refuses to parse, so merely importing the app module
// that validates addresses blows up the suite. Suites that need different
// behaviour still override this with their own `jest.mock('@stellar/stellar-sdk', …)`.
//
// `isValidEd25519PublicKey` is the one surface `utils/stellarValidation.ts`
// reaches for. It checks the shape the app depends on — 56 characters, upper
// case, `G` version byte — while the production SDK additionally verifies the
// base32 checksum. Tests that need to prove the app *consults* the SDK mock
// the export directly (see `__tests__/stellarValidation.test.ts`).
const BASE32_ALPHABET = /^[A-Z2-7]{55}$/;

module.exports = {
  __esModule: true,
  StrKey: {
    isValidEd25519PublicKey: (key) =>
      typeof key === 'string' && key.startsWith('G') && BASE32_ALPHABET.test(key.slice(1)),
  },
  Networks: {
    PUBLIC: 'Public Global Stellar Network ; September 2015',
    TESTNET: 'Test SDF Network ; September 2015',
  },
  Keypair: {
    fromSecret: (secret) => ({ publicKey: () => '', sign: () => Buffer.alloc(64) }),
    random: () => ({ publicKey: () => '', sign: () => Buffer.alloc(64) }),
  },
  Horizon: {
    Server: class {
      loadAccount() {
        return Promise.resolve({});
      }
      submitTransaction() {
        return Promise.resolve({ hash: 'stub-hash' });
      }
    },
  },
  Server: class {},
  TransactionBuilder: class {
    addOperation() {
      return this;
    }
    addMemo() {
      return this;
    }
    setTimeout() {
      return this;
    }
    build() {
      return { sign: () => {}, toXDR: () => 'stub-xdr' };
    }
  },
  Operation: { payment: () => ({}) },
  Asset: { native: () => ({}) },
  Memo: { text: () => ({}) },
};
